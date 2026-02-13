export function TxStepper({ step, error }: { step: string; error?: string }) {
  return <p className="text-xs text-muted-foreground">{error ? `Failed: ${error}` : `Status: ${step}`}</p>
}
