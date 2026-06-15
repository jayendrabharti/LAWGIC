import { BsGithub } from "react-icons/bs";
import Link from "next/link";
import { QuickLinks } from "@/utils/navLinks";
import Logo from "./Logo";
import { appName } from "@/utils/data";

export default async function Footer() {
  return (
    <footer className="mx-auto mt-20 w-full p-4 max-w-4xl">
      <div className="border-border border-t p-10">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 sm:place-items-center">
          {/* Brand Section */}
          <div className="md:col-span-1">
            <Logo />
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="mb-4 font-semibold">Quick Links</h3>
            <ul className="space-y-2">
              {QuickLinks.map((link, index) => (
                <li key={index}>
                  <Link
                    href={link.href}
                    target="_blank"
                    className="text-muted-foreground hover:text-primary flex items-center gap-2 text-sm transition-colors"
                  >
                    <link.icon size={16} />
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="border-border mt-8 border-t pt-8">
          <div className="flex flex-col items-center 6 md:flex-row">
            <div className="text-muted-foreground text-sm w-full text-center">
              © 2025 {appName}. All rights reserved.
            </div>
            
            {/* Hackathon Project Badge */}
            {/* <div className="flex items-center gap-2">
              <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-3 py-1 rounded-full text-xs font-medium">
                Hackathon Project
              </div>
            </div> */}
          </div>
          
          {/* Development Team */}
          <div className="mt-6 text-center">
            <h4 className="text-muted-foreground mb-4 text-sm font-medium">Developed by</h4>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link
                href="https://github.com/jayendrabharti"
                target="_blank"
                className="bg-muted hover:bg-muted/80 hover:text-primary hover:ring-ring flex items-center gap-2 rounded-lg px-4 py-2 font-medium transition-all hover:ring-2 hover:shadow-md"
              >
                <BsGithub size={16} />
                Jayendra Bharti
              </Link>
              <Link
                href="https://github.com/parth-yadav"
                target="_blank"
                className="bg-muted hover:bg-muted/80 hover:text-primary hover:ring-ring flex items-center gap-2 rounded-lg px-4 py-2 font-medium transition-all hover:ring-2 hover:shadow-md"
              >
                <BsGithub size={16} />
                Parth Yadav
              </Link>
              <Link
                href="https://github.com/Krrish2401"
                target="_blank"
                className="bg-muted hover:bg-muted/80 hover:text-primary hover:ring-ring flex items-center gap-2 rounded-lg px-4 py-2 font-medium transition-all hover:ring-2 hover:shadow-md"
              >
                <BsGithub size={16} />
                Krrish Chaudhary
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
