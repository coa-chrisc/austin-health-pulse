import LifespanCalculator from "./LifespanCalculator";

/**
 * Opt-in individual calculator block (VITE_ENABLE_PERSONAL_CALCULATOR=true).
 * Lazy-loaded behind the flag so the lifespan code stays out of the main chunk.
 */
export default function PersonalFactorsSection() {
  return (
    <section className="mt-12">
      <div className="text-center mb-6">
        <h3 className="text-2xl font-bold text-aph-dark-blue mb-2">
          How do personal factors affect life expectancy?
        </h3>
        <p className="text-sm text-aph-dark-gray max-w-2xl mx-auto">
          Neighborhood is one factor. Personal choices and exposures matter
          too. Try these tools to see how.
        </p>
      </div>
      <LifespanCalculator />
    </section>
  );
}
