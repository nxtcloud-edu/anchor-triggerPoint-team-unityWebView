import eslintConfig from '@frontend/eslint-config';

export default [
  { ignores: ['dist', 'public'] },
  ...eslintConfig,
  {
    rules: {
      'react/react-in-jsx-scope': 'off', // 자동 JSX 런타임이라 React import 불필요
      'no-unused-vars': 'off', // TS 파일은 @typescript-eslint/no-unused-vars가 대신 검사 (core 룰과 중복 실행되며 오탐)
    },
  },
];
