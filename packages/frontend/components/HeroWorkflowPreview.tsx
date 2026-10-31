export function HeroWorkflowPreview() {
  return (
    <aside className="hero-product-preview" aria-label="Illustration of PatchPool's bounty and escrow workflow">
      <div className="preview-topline">
        <span className="preview-label">PRODUCT ILLUSTRATION</span>
        <span className="preview-illustration-tag">Not a live bounty</span>
      </div>
      <div className="preview-task">
        <span className="preview-task-mark" aria-hidden="true"><span /></span>
        <div><small>SOFTWARE FIX BOUNTY</small><h2>A focused fix, ready to fund</h2></div>
        <span className="preview-dots" aria-hidden="true">•••</span>
      </div>
      <div className="preview-reward-row">
        <div><small>REWARD</small><strong>Set by sponsor</strong></div>
        <div className="preview-escrow-status"><span className="escrow-lock" aria-hidden="true">◆</span><span><small>ESCROW MODEL</small><strong>Contract governed</strong></span></div>
      </div>
      <div className="preview-funding-model">
        <div className="funding-model-glyph" aria-hidden="true"><i /><i /><i /><b /></div>
        <div><small>SHARED FUNDING</small><strong>Creator + additional sponsors</strong></div>
        <span className="funding-arrow" aria-hidden="true">→</span>
        <div className="funding-pool" aria-hidden="true"><span>ESCROW</span></div>
      </div>
      <div className="preview-stage-heading"><span>FROM PROBLEM TO PAYOUT</span><span>Human review</span></div>
      <ol className="preview-stages">
        <li><i>01</i><span>Sponsor</span></li><li><i>02</i><span>Escrow</span></li><li><i>03</i><span>Submit</span></li><li><i>04</i><span>Review</span></li><li><i>05</i><span>Release</span></li>
      </ol>
      <p className="preview-honesty-note">Illustrative workflow. No example users, amounts or Mainnet activity are shown.</p>
    </aside>
  );
}
