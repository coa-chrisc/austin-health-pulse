import { SERVICE_GUIDE_URL } from "../../lib/constants";
import { buildZipServicesUrl } from "../../lib/serviceGuide";

interface ServiceGuideZipLinkProps {
  zip: string;
  /** Extra classes to adapt spacing to the host card. */
  className?: string;
}

/** Links to the city's Service Guide pre-filtered by ZIP; hidden when no guide URL is configured. */
export default function ServiceGuideZipLink({
  zip,
  className = "",
}: ServiceGuideZipLinkProps) {
  if (!SERVICE_GUIDE_URL) return null;
  return (
    <a
      href={buildZipServicesUrl(SERVICE_GUIDE_URL, zip)}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-aph-green text-white font-semibold text-sm hover:brightness-110 active:scale-[0.97] transition ${className}`}
    >
      <span className="material-symbols-outlined text-base">handshake</span>
      Find public health and social services in ZIP {zip}
      <span className="material-symbols-outlined text-base">open_in_new</span>
    </a>
  );
}
