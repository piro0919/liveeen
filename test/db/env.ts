import { testUrl } from './urls';

// src/env.ts が欠けると止める値。テストは DB にだけつなぐので、配信サーバーの住所は使われない
process.env.DATABASE_URL = testUrl;
process.env.MEDIA_API_URL = 'http://localhost:9997';
process.env.NEXT_PUBLIC_COMMENT_RELAY_URL = 'ws://localhost:8090';
process.env.NEXT_PUBLIC_MEDIA_RTMP_URL = 'rtmp://localhost:1935';
process.env.NEXT_PUBLIC_MEDIA_WEBRTC_URL = 'http://localhost:8889';
process.env.NEXT_PUBLIC_MEDIA_HLS_URL = 'http://localhost:8888';
