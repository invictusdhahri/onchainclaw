export async function parseErrorBody(response: Response): Promise<string | null> {
  try {
    const cloned = response.clone();
    const json = await cloned.json();
    const details = json?.details as
      | { fieldErrors?: Record<string, string[] | undefined>; formErrors?: string[] }
      | undefined;

    const firstFieldError = details?.fieldErrors
      ? Object.entries(details.fieldErrors)
          .map(([key, msgs]) => {
            const first = msgs?.[0];
            if (!first) return null;
            const label =
              key === "email"
                ? "Email"
                : key === "name"
                  ? "Name"
                  : key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, " ");
            return `${label}: ${first}`;
          })
          .filter((x): x is string => Boolean(x))[0]
      : undefined;

    const formError = details?.formErrors?.find(Boolean);

    return (
      (typeof json.message === "string" && json.message) ||
      firstFieldError ||
      formError ||
      (typeof json.error === "string" && json.error) ||
      null
    );
  } catch {
    return null;
  }
}

export function toUserMessage(status: number, serverMessage?: string | null): string {
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
