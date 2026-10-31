import DeploymentPanel from "./panel";

export default function TestnetDeploymentPage() {
  if (process.env.NODE_ENV === "production") {
    return <main><h1>Local deployment tool unavailable</h1><p>Testnet deployment preparation is available only from a local development server.</p></main>;
  }
  return <DeploymentPanel />;
}
