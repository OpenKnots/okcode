"use client";

import { motion } from "framer-motion";
import { Triangle, Zap, Layers, Box, Hexagon, Circle, Diamond, Octagon } from "lucide-react";

const companies = [
  { name: "Acme Corp", icon: Triangle },
  { name: "Flux", icon: Zap },
  { name: "Layers", icon: Layers },
  { name: "Vortex", icon: Box },
  { name: "Hexa", icon: Hexagon },
  { name: "Orbit", icon: Circle },
  { name: "Prism", icon: Diamond },
  { name: "Nexus", icon: Octagon },
];

export function LogoCloud() {
  return (
    <div id="customers" className="relative z-20 pb-24 pt-8 bg-background">
      <div className="w-full flex justify-center px-6">
        <div className="w-full max-w-4xl text-center">
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-lg text-secondary-foreground mb-2"
          >
            Powering the world's best product teams.
          </motion.p>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-lg text-muted-foreground mb-16"
          >
            From next-gen startups to established enterprises.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative group cursor-pointer"
          >
            {/* Logo grid with variety */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-16 gap-y-10 items-center justify-items-center transition-all duration-300 group-hover:blur-[2.5px] group-hover:opacity-50">
              {companies.map((company, companyIndex) => {
                const Icon = company.icon;
                return (
                  <motion.div
                    key={company.name}
                    initial={{ opacity: 0, scale: 0.8 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: companyIndex * 0.05 }}
                    className="text-foreground font-semibold text-xl flex items-center gap-2"
                  >
                    <Icon className="w-5 h-5 fill-current" />
                    {company.name}
                  </motion.div>
                );
              })}
            </div>

            {/* Hover overlay button - Use semantic tokens */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
              <div className="px-5 py-2.5 bg-secondary/80 backdrop-blur-sm border border-border rounded-full text-sm text-secondary-foreground flex items-center gap-2">
                Meet our customers
                <span aria-hidden="true">›</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
