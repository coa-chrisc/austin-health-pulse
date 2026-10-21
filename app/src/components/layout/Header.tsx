import { NavLink } from "react-router-dom";
import { cityConfig, logoSrc } from "../../lib/cityConfig";

const modes = [
  {
    to: "/",
    label: "Check Your Neighborhood",
    shortLabel: "Neighborhood",
    icon: "home",
  },
  { to: "/explore", label: "Explore the Map", shortLabel: "Map", icon: "map" },
  {
    to: "/compare",
    label: "Compare ZIP Codes",
    shortLabel: "Compare",
    icon: "compare_arrows",
  },
];

interface HeaderProps {
  onInfoClick?: () => void;
}

export default function Header({ onInfoClick }: HeaderProps) {
  return (
    <header className="bg-ink text-on-brand">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-accent rounded-control flex items-center justify-center">
            {logoSrc ? (
              <img
                src={logoSrc}
                alt=""
                className="w-7 h-7 object-contain"
              />
            ) : (
              <span className="material-symbols-outlined text-on-brand text-2xl">
                health_and_safety
              </span>
            )}
          </div>
          <div>
            <h1 className="text-lg font-semibold leading-tight">
              {cityConfig.appName}
            </h1>
            <p className="text-xs text-primary-soft opacity-80">
              {cityConfig.agency.name}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <nav className="hidden md:flex gap-1">
            {modes.map((mode) => (
              <NavLink
                key={mode.to}
                to={mode.to}
                end={mode.to === "/"}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-4 py-2 rounded-control text-sm font-semibold transition-colors ${
                    isActive
                      ? "bg-primary text-on-brand"
                      : "text-primary-soft hover:bg-on-brand/10"
                  }`
                }
              >
                <span className="material-symbols-outlined text-lg">
                  {mode.icon}
                </span>
                {mode.label}
              </NavLink>
            ))}
          </nav>
          <button
            onClick={onInfoClick}
            className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-control border border-on-brand/25 bg-on-brand/5 text-primary-soft text-sm font-semibold hover:bg-on-brand/15 hover:text-on-brand transition-colors"
            aria-label="About this tool"
          >
            <span className="material-symbols-outlined text-lg">info</span>
            <span className="hidden sm:inline">About</span>
          </button>
        </div>
      </div>
      {/* Mobile nav */}
      <nav className="md:hidden flex border-t border-on-brand/10">
        {modes.map((mode) => (
          <NavLink
            key={mode.to}
            to={mode.to}
            end={mode.to === "/"}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center gap-1 py-2 text-xs font-semibold transition-colors ${
                isActive ? "bg-primary text-on-brand" : "text-primary-soft"
              }`
            }
          >
            <span className="material-symbols-outlined text-lg">
              {mode.icon}
            </span>
            {mode.shortLabel}
          </NavLink>
        ))}
      </nav>
      {/* Brand accent stripe */}
      <div className="h-1 bg-gradient-to-r from-accent via-primary to-ink" />
    </header>
  );
}
