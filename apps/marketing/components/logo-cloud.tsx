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
    <div id="customers" className="relative z-20 pb-32 pt-12 bg-background">
      <div className="w-full flex justify-center px-6">
        <div className="w-full max-w-6xl text-center">
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-xl md:text-2xl text-secondary-foreground font-semibold mb-3"
          >
            Powering the world's best product teams.
          </motion.p>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-lg md:text-xl text-muted-foreground mb-16"
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
              {companies.map((company, i) => {
                const Icon = company.icon;
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0.8 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: i * 0.05 }}
                    className="text-foreground font-bold text-2xl flex items-center gap-3"
                  >
                    <Icon className="w-5 h-5 fill-current" />
                    {company.name}
                  </motion.div>
                );
              })}
            </div>

            {/* Hover overlay button - Use semantic tokens */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
              <div className="px-7 py-3.5 bg-secondary/80 backdrop-blur-sm border border-border rounded-2xl text-base font-semibold text-secondary-foreground flex items-center gap-2 shadow-lg">
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
