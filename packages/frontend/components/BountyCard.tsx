import { useEffect, useRef, type ReactNode } from "react";

type Props = {
  id: string;
  title: string;
  description: string;
  reward: string;
  status: number;
  statusLabel: string;
  submitBy: string;
  submitDateTime: string;
  reviewBy: string;
  reviewDateTime: string;
  reviewer: string;
  reviewerHref?: string;
  autoOpen?: boolean;
  children: ReactNode;
};

export function BountyCard({
  id,
  title,
  description,
  reward,
  status,
  statusLabel,
  submitBy,
  submitDateTime,
  reviewBy,
  reviewDateTime,
  reviewer,
  reviewerHref,
  autoOpen = false,
  children,
}: Props) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const statusClass = status === 2 ? "paid" : status === 3 ? "refunded" : status === 4 ? "refunding" : status === 1 ? "approved" : "open";

  useEffect(() => {
    if (autoOpen && detailsRef.current) detailsRef.current.open = true;
  }, [autoOpen]);

  return (
    <article className="stat-card bounty-card">
      <div className="bounty-card-top">
        <span className="bounty-card-id">BOUNTY #{id}</span>
        <span className={`bounty-state bounty-state-${statusClass}`}>{statusLabel}</span>
      </div>
      <div className="bounty-card-main">
        <div className="bounty-card-copy">
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        <div className="bounty-card-reward"><span>ESCROWED POOL</span><strong>{reward}</strong></div>
      </div>
      <div className="bounty-card-links"><a href={`/bounties/${encodeURIComponent(id)}`}>View bounty details <span aria-hidden="true">↗</span></a></div>
      <dl className="bounty-card-meta">
        <div><dt>SUBMIT BY</dt><dd><time dateTime={submitDateTime}>{submitBy}</time></dd></div>
        <div><dt>REVIEW / SETTLEMENT</dt><dd><time dateTime={reviewDateTime}>{reviewBy}</time></dd></div>
        <div><dt>ASSIGNED REVIEWER</dt><dd>{reviewerHref ? <a href={reviewerHref} target="_blank" rel="noreferrer">{reviewer}</a> : reviewer}</dd></div>
      </dl>
      <details ref={detailsRef} className="bounty-card-details">
        <summary>Full terms and available actions <span aria-hidden="true">⌄</span></summary>
        <div className="bounty-card-details-content">{children}</div>
      </details>
    </article>
  );
}
