// ----------------------------------------------------------------------

export function getErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (
      error as {
        response?: { data?: { message?: string; errors?: Record<string, string[]> } };
      }
    ).response;
    const validationMessage = response?.data?.errors
      ? Object.values(response.data.errors).flat()[0]
      : undefined;

    return validationMessage || response?.data?.message || 'The request could not be completed.';
  }

  if (error instanceof Error) {
    return error.message || error.name || 'An error occurred';
  }

  if (typeof error === 'string') {
    return error;
  }

  if (typeof error === 'object' && error !== null) {
    const errorMessage = (error as { message?: string }).message;
    if (typeof errorMessage === 'string') {
      return errorMessage;
    }
  }

  return `Unknown error: ${error}`;
}
