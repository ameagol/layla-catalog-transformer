export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message.replace(/^Error invoking remote method '[^']+':\s*/u, '')
  return 'An unexpected local application error occurred.'
}

