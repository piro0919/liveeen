/**
 * 配信のつなぎの種類（MediaMTX の paths の source.type）から、切るための API の住所を作る。
 * 知らない種類なら null。形は https://github.com/bluenviron/mediamtx/blob/v1.21.2/api/openapi.yaml
 */
export function kickPath(source: { type: string; id: string }): string | null {
  const kind: Record<string, string> = {
    rtmpConn: 'rtmpconns',
    rtmpsConn: 'rtmpconns',
    webRTCSession: 'webrtcsessions',
  };
  const collection = kind[source.type];
  return collection ? `/v3/${collection}/kick/${encodeURIComponent(source.id)}` : null;
}
