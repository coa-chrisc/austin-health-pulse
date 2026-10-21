declare module "virtual:city-config" {
  export const cityConfig: import("./types/cityConfig").CityConfig;
  export const logoSrc: import("./types/cityConfig").LogoSrc;
  export const dataUrls: import("./types/cityConfig").CityDataUrls;
}

/** Side-effect import of the theme font's 400/500/600/700 latin CSS (see cityConfigPlugin). */
declare module "virtual:theme-fonts" {}
