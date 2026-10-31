type ConnectorIdentity = { id?: string; name?: string } | null | undefined;

/** Match the provider identity exposed by Wagmi's EIP-6963 connector.
 * EIP-6963 metadata is self-reported; this restricts the UI selection but
 * does not authenticate the wallet software or replace a live BridgeKey check.
 */
export function isBridgeKeyConnector(connector: ConnectorIdentity): boolean {
  return `${connector?.name ?? ""} ${connector?.id ?? ""}`
    .toLowerCase()
    .includes("bridgekey");
}
