import type { Config } from './config';
import { summarize } from './domain/convert';
import type { DummySession } from './domain/dummy';
import { emptyState, type RosterMember, type State, type StoredSession } from './domain/model';
import { parseRoster, type RosterError } from './domain/roster';
import type { UnitySession } from './domain/unity';
import type { Storage } from './storage/storage';

const DEFAULT_SIMULATOR = '1';

/** 유니티 세션 Id는 32자리 GUID — 원본 파일 이름이 되므로 경로 문자는 받지 않는다 */
const SESSION_ID = /^[A-Za-z0-9_-]{1,128}$/;

/** 요청 값이 잘못된 경우 — HTTP 400으로 돌려준다 */
export class ValidationError extends Error {}

/** 원본에 서버가 덧붙여 저장하는 값 */
type StoredRaw = UnitySession & { receivedAt?: string; simulatorId?: string };

const inRange = (simulatorId: string, count: number) => {
  const no = Number(simulatorId);
  return Number.isInteger(no) && no >= 1 && no <= count;
};

/** 받은 날짜(한국 시간) 폴더에 세션 Id로 원본을 둔다 — 사람이 바뀌어도 객체를 옮기지 않는다 */
const rawKeyOf = (id: string, at: Date) => {
  const yyyy = at.getFullYear();
  const mm = String(at.getMonth() + 1).padStart(2, '0');
  const dd = String(at.getDate()).padStart(2, '0');
  return `raw/${yyyy}/${mm}/${dd}/${id}.json`;
};

/**
 * 더미 명단·세션을 지운다. 실제 세션이 더미 사람에게 옮겨져 있었으면 미배정으로,
 * 더미 사람에게 걸린 시뮬레이터 배치는 해제로 돌린다.
 */
const removeDummy = (draft: State) => {
  const dummyIds = new Set(draft.members.filter(m => m.dummy).map(m => m.id));
  const before = draft.sessions.length;

  draft.members = draft.members.filter(m => !m.dummy);
  draft.sessions = draft.sessions.filter(s => !s.dummy);
  for (const s of draft.sessions) if (s.memberId && dummyIds.has(s.memberId)) s.memberId = null;
  for (const [id, a] of Object.entries(draft.simulators)) {
    if (a.memberId && dummyIds.has(a.memberId)) draft.simulators[id] = { memberId: null, assignedAt: null };
  }

  return { members: dummyIds.size, sessions: before - draft.sessions.length };
};

/**
 * 서버 상태 전체를 메모리에 두고, 바뀔 때마다 db/state.json으로 통째로 저장한다.
 * 쓰기는 한 줄로 세워 처리해서 동시에 들어온 요청이 서로 덮어쓰지 않게 한다.
 */
export class Repo {
  private queue: Promise<unknown> = Promise.resolve();

  private constructor(
    private readonly storage: Storage,
    private readonly config: Config,
    private current: State,
  ) {}

  static async open(storage: Storage, config: Config) {
    const state = (await storage.readState()) ?? emptyState();
    if (config.simulatorCount) state.company.simulatorCount = config.simulatorCount;
    return new Repo(storage, config, state);
  }

  get state(): Readonly<State> {
    return this.current;
  }

  /** 상태 사본을 바꿔 저장에 성공했을 때만 메모리 상태를 바꾼다 */
  private change<T>(fn: (draft: State) => T | Promise<T>): Promise<T> {
    const run = async () => {
      const draft = structuredClone(this.current);
      const result = await fn(draft);
      await this.storage.writeState(draft);
      this.current = draft;
      return result;
    };
    const next = this.queue.then(run, run);
    this.queue = next.catch(() => undefined);
    return next;
  }

  ingest(raw: UnitySession, now: Date): Promise<StoredSession> {
    if (typeof raw?.Id !== 'string' || !SESSION_ID.test(raw.Id)) {
      return Promise.reject(new ValidationError('세션 Id가 없거나 형식이 맞지 않습니다'));
    }

    return this.change(async draft => {
      const simulatorId = String(raw.SimulatorId || DEFAULT_SIMULATOR);
      const existing = draft.sessions.find(s => s.id === raw.Id);
      const receivedAt = existing?.receivedAt ?? now.toISOString();
      const rawKey = existing?.rawKey ?? rawKeyOf(raw.Id, now);

      await this.storage.putRaw(rawKey, { ...raw, receivedAt, simulatorId });

      // 대수를 줄인 뒤 남아 있는 범위 밖 배치는 화면에서 보이지도 지울 수도 없으므로 쓰지 않는다
      const assigned = inRange(simulatorId, draft.company.simulatorCount)
        ? (draft.simulators[simulatorId]?.memberId ?? null)
        : null;

      const session: StoredSession = {
        ...summarize(raw, this.config),
        memberId: existing ? existing.memberId : assigned,
        simulatorId,
        receivedAt,
        rawKey,
      };

      if (existing) draft.sessions[draft.sessions.indexOf(existing)] = session;
      else draft.sessions.push(session);
      return session;
    });
  }

  upsertRoster(text: string): Promise<{ added: number; updated: number; errors: RosterError[] }> {
    const { rows, errors } = parseRoster(text);

    return this.change(draft => {
      let added = 0;
      let updated = 0;
      for (const row of rows) {
        const index = draft.members.findIndex(m => m.id === row.id);
        if (index >= 0) {
          draft.members[index] = row;
          updated++;
        } else {
          draft.members.push(row);
          added++;
        }
      }
      return { added, updated, errors };
    });
  }

  assignSimulator(simulatorId: string, memberId: string | null, now: Date): Promise<void> {
    return this.change(draft => {
      if (!inRange(simulatorId, draft.company.simulatorCount)) {
        throw new ValidationError(`시뮬레이터 ${simulatorId}번은 없습니다`);
      }
      if (memberId !== null && !draft.members.some(m => m.id === memberId)) {
        throw new ValidationError(`군번 ${memberId}을(를) 명단에서 찾을 수 없습니다`);
      }
      draft.simulators[String(Number(simulatorId))] = {
        memberId,
        assignedAt: memberId ? now.toISOString() : null,
      };
    });
  }

  assignSession(sessionId: string, memberId: string): Promise<void> {
    return this.change(draft => {
      const session = draft.sessions.find(s => s.id === sessionId);
      if (!session) throw new ValidationError(`세션 ${sessionId}을(를) 찾을 수 없습니다`);
      if (!draft.members.some(m => m.id === memberId)) {
        throw new ValidationError(`군번 ${memberId}을(를) 명단에서 찾을 수 없습니다`);
      }
      session.memberId = memberId;
    });
  }

  /**
   * 원본에서 계산 결과를 다시 만든다 (지표 기준값을 바꾼 뒤 사용).
   * 원본은 있는데 상태에 없는 세션(상태 저장이 실패했던 경우)은 미배정으로 되살린다.
   */
  recompute(): Promise<{ recomputed: number; restored: number }> {
    return this.change(async draft => {
      let recomputed = 0;
      for (const [i, session] of draft.sessions.entries()) {
        if (session.dummy) continue;
        const raw = (await this.storage.getRaw(session.rawKey)) as StoredRaw;
        const { memberId, simulatorId, receivedAt, rawKey, photoKey } = session;
        draft.sessions[i] = {
          ...summarize(raw, this.config),
          memberId,
          simulatorId,
          receivedAt,
          rawKey,
          ...(photoKey ? { photoKey } : {}),
        };
        recomputed++;
      }

      let restored = 0;
      const knownKeys = new Set(draft.sessions.map(s => s.rawKey));
      for (const rawKey of await this.storage.listRaw()) {
        if (knownKeys.has(rawKey)) continue;
        const raw = (await this.storage.getRaw(rawKey)) as StoredRaw;
        if (typeof raw?.Id !== 'string' || !SESSION_ID.test(raw.Id) || draft.sessions.some(s => s.id === raw.Id)) {
          continue;
        }
        draft.sessions.push({
          ...summarize(raw, this.config),
          memberId: null,
          simulatorId: String(raw.simulatorId ?? raw.SimulatorId ?? DEFAULT_SIMULATOR),
          receivedAt: raw.receivedAt ?? new Date(0).toISOString(),
          rawKey,
        });
        restored++;
      }

      return { recomputed, restored };
    });
  }

  /**
   * 발표용 더미를 넣는다. 이전 더미는 지우고 새로 넣으며, 실제 명단의 군번과 겹치는 더미는 뺀다.
   * 원본(raw/)은 쓰지 않고 상태에만 한 번에 저장한다.
   */
  seedDummy(data: { members: RosterMember[]; sessions: DummySession[] }): Promise<{ members: number; sessions: number }> {
    return this.change(draft => {
      removeDummy(draft);

      const realIds = new Set(draft.members.map(m => m.id));
      const members = data.members.filter(m => !realIds.has(m.id)).map(m => ({ ...m, dummy: true }));
      const allowed = new Set(members.map(m => m.id));
      const takenSessionIds = new Set(draft.sessions.map(s => s.id));
      const sessions: StoredSession[] = data.sessions
        .filter(s => allowed.has(s.memberId) && !takenSessionIds.has(s.raw.Id))
        .map(s => ({
          ...summarize(s.raw, this.config),
          memberId: s.memberId,
          simulatorId: String(s.raw.SimulatorId ?? DEFAULT_SIMULATOR),
          receivedAt: s.receivedAt,
          rawKey: rawKeyOf(s.raw.Id, new Date(s.receivedAt)),
          dummy: true,
        }));

      draft.members.push(...members);
      draft.sessions.push(...sessions);
      return { members: members.length, sessions: sessions.length };
    });
  }

  clearDummy(): Promise<{ members: number; sessions: number }> {
    return this.change(removeDummy);
  }

  /** 세션 Id → 사진 키. 이미 지워진 세션은 건너뛴다 */
  setPhotoKeys(keys: Record<string, string>): Promise<number> {
    return this.change(draft => {
      let count = 0;
      for (const s of draft.sessions) {
        if (keys[s.id]) {
          s.photoKey = keys[s.id];
          count++;
        }
      }
      return count;
    });
  }
}
