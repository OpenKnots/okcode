"use client";

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  const pathname = typeof window !== "undefined" ? window.location.pathname : "";

  // Log the error to the console so it will be forwarded to server logs and captured by auto-fix
  console.error(error);

  return (
    <html>
      <head>
        <style>{`
          * { box-sizing: border-box; }
          body {
            margin: 0;
            font-family: ui-monospace, monospace;
            padding: 2rem;
            background: #fafafa;
            color: #171717;
            font-size: 14px;
            min-height: 100vh;
            display: flex;
            align-items: flex-start;
          }
          .error-container {
            width: 100%;
            max-width: 560px;
            min-width: 0;
          }
          .error-header {
            display: flex;
            align-items: center;
            gap: 12px;
          }
          .error-icon {
            width: 20px;
            height: 20px;
            border-radius: 50%;
            background: #fef2f2;
            color: #b91c1c;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 600;
            font-size: 12px;
            flex-shrink: 0;
          }
          .error-message {
            margin: 0;
            font-weight: 500;
            line-height: 1.5;
          }
          .error-message code {
            background: #e5e5e5;
            padding: 0.1em 0.3em;
          }
          .error-summary {
            margin: 0.25rem 0 0 2rem;
            padding: 0;
            font-size: 13px;
            color: #b91c1c;
            line-height: 1.5;
          }
          .error-details-wrapper {
            margin: 1rem 0 0 2rem;
          }
          .error-details summary {
            list-style: none;
            cursor: pointer;
            padding: 0;
            color: #737373;
            font-size: 12px;
            user-select: none;
            display: flex;
            align-items: center;
            gap: 6px;
          }
          .error-details summary::-webkit-details-marker {
            display: none;
          }
          .error-details summary .chevron {
            display: inline-flex;
            align-items: center;
            font-size: 0.6rem;
            transition: transform 0.2s ease;
            transform: rotate(-90deg);
          }
          .error-details[open] summary .chevron {
            transform: rotate(0deg);
          }
          .error-stack-slot {
            height: 320px;
            margin-top: 0.5rem;
          }
          .error-details-wrapper:not(:has(details[open])) .error-stack {
            visibility: hidden;
          }
          .error-stack {
            margin: 0;
            padding: 1rem;
            background: #f5f5f5;
            overflow: auto;
            max-width: 100%;
            min-width: 0;
            height: 100%;
            box-sizing: border-box;
            font-size: 11px;
            line-height: 1.5;
          }
        `}</style>
      </head>
      <body>
        <div className="error-container">
          <div className="error-header">
            <div className="error-icon">!</div>
            <div>
              <p className="error-message">
                An application error has occurred while loading <code>{pathname || "/"}</code>
              </p>
            </div>
          </div>
          <div className="error-summary">{error.message || "Unknown error"}</div>
          {error.stack && (
            <div className="error-details-wrapper">
              <details className="error-details">
                <summary>
                  <span className="chevron">▼</span>
                  View full error trace
                </summary>
              </details>
              <div className="error-stack-slot">
                <pre className="error-stack">{error.stack}</pre>
              </div>
            </div>
          )}
        </div>
      </body>
    </html>
  );
}
