export function Footer() {
  const footerLinks = {
    Features: [
      "Plan",
      "Build",
      "Insights",
      "Customer Requests",
      "Sprint Asks",
      "Security",
      "Mobile",
    ],
    Product: [
      "Pricing",
      "Method",
      "Integrations",
      "Changelog",
      "Documentation",
      "Download",
      "Switch",
    ],
    Company: ["About", "Customers", "Careers", "Now", "README", "Quality", "Brand"],
    Resources: [
      "Developers",
      "Status",
      "Startups",
      "Report vulnerability",
      "DPA",
      "Privacy",
      "Terms",
    ],
    Connect: ["Contact us", "Community", "X (Twitter)", "GitHub", "YouTube"],
  };

  return (
    <footer className="border-t border-border py-20 px-6 bg-background">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-8">
          {/* Logo - Use semantic token */}
          <div className="col-span-2 md:col-span-1">
            <svg
              width="20"
              height="20"
              viewBox="0 0 100 100"
              fill="none"
              className="text-foreground"
            >
              <path
                d="M20 30 L50 10 L80 30 L80 70 L50 90 L20 70 Z"
                fill="currentColor"
                stroke="currentColor"
                strokeWidth="2"
              />
              <path d="M50 10 L50 50 L20 30" className="fill-background" />
              <path d="M50 50 L80 70 L50 90" className="fill-background" />
            </svg>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h3 className="text-foreground font-bold text-base mb-5">{category}</h3>
              <ul className="space-y-3.5">
                {links.map((link) => (
                  <li key={link}>
                    <a
                      href="#"
                      className="text-muted-foreground hover:text-secondary-foreground transition-colors text-sm"
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </footer>
  );
}
