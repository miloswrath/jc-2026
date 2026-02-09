type Env = Record<string, string | undefined>;

export type ServerConfig = {
  host: string;
  port: number;
};

export function getServerConfig(env: Env): ServerConfig {
  const host = env.HOST?.trim() || "0.0.0.0";
  const portRaw = Number(env.PORT ?? 8088);
  const port = Number.isFinite(portRaw) && portRaw > 0 ? portRaw : 8088;

  return { host, port };
}
