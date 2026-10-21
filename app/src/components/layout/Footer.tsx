import { cityConfig } from "../../lib/cityConfig";
import {
  ENABLE_PERSONAL_CALCULATOR,
  SERVICE_GUIDE_URL,
} from "../../lib/constants";

export default function Footer() {
  const sources = [...new Set(cityConfig.dataSources.map((d) => d.source))].join(
    ", ",
  );
  return (
    <footer className="bg-aph-dark-blue text-aph-light-blue text-xs py-6">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between gap-4">
          <div>
            <p className="font-semibold text-white mb-1">{cityConfig.appName}</p>
            <p>
              {cityConfig.agency.name} | {cityConfig.agency.parent}
            </p>
            <p className="mt-2 text-aph-light-gray max-w-md">
              This tool provides statistical estimates based on historical data
              and is intended for informational purposes only. Individual
              outcomes may vary.
            </p>
          </div>
          <div className="text-left md:text-right">
            <p className="font-semibold text-white mb-1">Data Sources</p>
            {cityConfig.dataSources.map((d) => (
              <p key={d.label}>
                {d.label}: {d.source}
              </p>
            ))}
            <p className="mt-2 text-aph-light-gray">
              Data last updated {cityConfig.dataAsOf}
            </p>
          </div>
        </div>
        <div
          className="mt-4 rounded-lg border border-white/20 bg-white/5 p-3"
          aria-label="Methodology and public data"
        >
          <p className="font-semibold text-white mb-1 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-base">
              verified_user
            </span>
            Methodology &amp; Public Data
          </p>
          <p className="max-w-3xl">
            Neighborhood figures come only from aggregate, de-identified public
            datasets: {sources}.
          </p>
          <p className="max-w-3xl mt-1">
            What you enter here (
            {ENABLE_PERSONAL_CALCULATOR
              ? "a ZIP code, your age, your location, or your lifespan estimator answers"
              : "a ZIP code, your age, or your location"}
            ) stays in your browser. It is not sent anywhere or saved, and
            on kiosk displays it is cleared when the idle screen starts.
            {SERVICE_GUIDE_URL &&
              (ENABLE_PERSONAL_CALCULATOR
                ? " If you open a Service Guide link, the link includes the ZIP code or the general service topics, never your answers."
                : " If you open a Service Guide link, the link includes the ZIP code.")}{" "}
            The map loads its tiles from OpenStreetMap, the only outside site
            this page loads from. This site has no
            accounts, cookies, or analytics; it only remembers, on your device,
            whether you have seen the tour.
          </p>
        </div>
      </div>
    </footer>
  );
}
