/**
 * 유니티 ShootingSessionRecord(JsonUtility 직렬화) 그대로의 모양.
 * 원본: Assets/Scripts/Content/Records/ShootingRecordData.cs
 * 좌표·길이는 미터, x는 사수 기준 오른쪽 +, y는 위 +.
 */
export interface UnityTrace {
  StartMs: number;
  StepMs: number;
  RightMrad: number[];
  UpMrad: number[];
}

export interface UnityShot {
  Index: number;
  Time: number;
  Hit: boolean;
  X: number;
  Y: number;
  CenterDistance: number;
  RangeMeters: number;
  Score: number;
  Zone: string;
  Input: string;
  LeftHand: boolean;
  CantDegrees: number;
  Tracking: string;
  TrackingStability: number;
  Trace?: UnityTrace;
  /** 결과 창이 탄흔을 그리는 표적 상자 앞면 비율 좌표 (-0.5 ~ 0.5). 이 값을 보내는 빌드부터 있다 */
  HasFace?: boolean;
  FaceX?: number;
  FaceY?: number;
}

export interface UnitySession {
  Version: number;
  Id: string;
  ShooterId?: string;
  ShooterName?: string;
  StageIndex: number;
  StageName: string;
  DistanceMeters: number;
  StartedAt: string;
  DurationSeconds: number;
  EndReason: string;
  MagazineSize: number;
  ShotsFired: number;
  HitCount: number;
  TotalScore: number;
  MaxShotScore: number;
  MpiX: number;
  MpiY: number;
  GroupSize: number;
  MeanRadius: number;
  AppVersion?: string;
  Target?: { ProfileName?: string };
  Shots: UnityShot[];
  /** 시뮬레이터 번호. 예전 빌드는 보내지 않으므로 없으면 "1" */
  SimulatorId?: string;
}
