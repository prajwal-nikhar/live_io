export const getBackendUrl = () => {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  if (typeof window === "undefined") return "http://localhost:4000";
  const origin = window.location.origin;
  if (origin.includes(".e2b.app")) {
    return origin.replace("3000-", "4000-");
  }
  return "http://localhost:4000";
};

export const getSocketUrl = () => {
  if (process.env.NEXT_PUBLIC_SOCKET_URL) {
    return process.env.NEXT_PUBLIC_SOCKET_URL;
  }
  return getBackendUrl();
};

export const getE2BTrafficAccessToken = (): string | null => {
  if (typeof window === "undefined") return null;

  const params = new URLSearchParams(window.location.search);
  const tokenKeys = [
    "e2b-traffic-access-token",
    "e2b_traffic_access_token",
    "traffic_access_token",
    "token",
    "_token",
  ];

  for (const key of tokenKeys) {
    const val = params.get(key);
    if (val) {
      localStorage.setItem("e2b_traffic_access_token", val);
      return val;
    }
  }

  const cached = localStorage.getItem("e2b_traffic_access_token");
  if (cached) return cached;

  try {
    const cookies = document.cookie.split(";");
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split("=");
      if (
        name === "e2b-traffic-access-token" ||
        name === "e2b_traffic_access_token"
      ) {
        localStorage.setItem("e2b_traffic_access_token", value);
        return value;
      }
    }
  } catch (e) {}

  return null;
};

let isRefreshing = false;

export const apiRequest = async (
  path: string,
  options: RequestInit = {},
  retryCount = 0,
): Promise<any> => {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const baseUrl = getBackendUrl();
  const e2bToken = getE2BTrafficAccessToken();

  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(e2bToken ? { "e2b-traffic-access-token": e2bToken } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers,
  });

  // Handle 401 Unauthorized with Automatic Refresh Token Rotation
  if (
    response.status === 401 &&
    retryCount === 0 &&
    !path.includes("/auth/login") &&
    !path.includes("/auth/refresh")
  ) {
    const storedRefreshToken =
      typeof window !== "undefined"
        ? localStorage.getItem("refreshToken")
        : null;
    if (storedRefreshToken && !isRefreshing) {
      isRefreshing = true;
      try {
        const refreshResponse = await fetch(`${baseUrl}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: storedRefreshToken }),
        });

        if (refreshResponse.ok) {
          const refreshData = await refreshResponse.json();
          localStorage.setItem("token", refreshData.accessToken);
          localStorage.setItem("refreshToken", refreshData.refreshToken);
          isRefreshing = false;

          // Retry original request with newly issued access token
          return apiRequest(path, options, 1);
        }
      } catch (err) {
        console.error("Refresh token failed:", err);
      } finally {
        isRefreshing = false;
      }

      // If refresh failed, clear tokens and redirect to login
      if (typeof window !== "undefined") {
        localStorage.removeItem("token");
        localStorage.removeItem("refreshToken");
        if (window.location.pathname.startsWith("/host")) {
          window.location.href = "/auth";
        }
      }
    }
  }

  if (!response.ok) {
    const errorData = await response
      .json()
      .catch(() => ({ message: "Request failed" }));
    throw new Error(errorData.message || "API request failed");
  }

  return response.json();
};

export const formatImageUrl = (
  url: string | null | undefined,
): string | null => {
  if (!url) return null;
  let trimmed = url.trim();
  if (
    !trimmed ||
    trimmed.toLowerCase() === "(blank)" ||
    trimmed.toLowerCase() === "blank"
  ) {
    return null;
  }

  if (
    trimmed.includes("drive.google.com") ||
    trimmed.includes("docs.google.com")
  ) {
    const fileIdMatch =
      trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
      trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/) ||
      trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (fileIdMatch && fileIdMatch[1]) {
      return `https://lh3.googleusercontent.com/d/${fileIdMatch[1]}`;
    }
  }

  return trimmed;
};
