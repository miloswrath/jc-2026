type LocationLike = {
  protocol: string;
  hostname: string;
};

export type WsUrlInputs = {
  envUrl?: string | null;
  location: LocationLike;
};

export function buildWsUrl({ envUrl, location }: WsUrlInputs) {
  if (envUrl) {
    return envUrl;
  }

  const hostname = location.hostname;
  if (!hostname) {
    return null;
  }

  const protocol = location.protocol === "https:" ? "wss" : "ws";
  return `${protocol}://${hostname}:8088`;
}

export function getWsUrl() {
  if (import.meta.env.MODE === "test") {
    return null;
  }

  return buildWsUrl({
    envUrl: import.meta.env.VITE_WS_URL,
    location: window.location
  });
}
