import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'kr.boplan.app',
  appName: '보플랜',
  webDir: 'build',
  server: {
    androidScheme: 'https',
  },
};

export default config;
