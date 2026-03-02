export function getMistralApiKey() {
  return process.env.MISTRAL_API?.trim() || process.env.MISTRAL_API_KEY?.trim() || "";
}

