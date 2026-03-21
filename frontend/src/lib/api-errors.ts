export async function parseErrorBody(response: Response): Promise<string | null> {
  try {
    const cloned = response.clone();
    const json = await cloned.json();
    return json.error || json.message || null;
  } catch {
    return null;
  }
}

export function toUserMessage(status: number, serverMessage?: string): string {
  if (status === 429) {
    return "Too many requests. Please wait a moment and try again.";
  }
  
  if (status === 502 || status === 503) {
    return "The service is temporarily unavailable. Please try again in a moment.";
  }
  
  if (status === 404) {
    return serverMessage || "Not found";
  }
  
  if (status >= 500) {
    return serverMessage || "Something went wrong on our end. Please try again.";
  }
  
  if (status >= 400) {
    return serverMessage || "Unable to complete your request. Please check your input and try again.";
  }
  
  return serverMessage || "Something went wrong. Please try again.";
}

export function toNetworkErrorMessage(): string {
  return "Unable to connect. Please check your internet connection and try again.";
}
