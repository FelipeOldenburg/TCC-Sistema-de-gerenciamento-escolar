import { useEffect, useState } from "react";
import cimolLogo from "@/assets/cimol-logo.png";
import { apiFetch, INSTITUTION_SLUG_STORAGE_KEY } from "@/lib/api";

export type InstitutionBrand = {
  slug: string;
  name: string;
  adminName: string;
  systemName: string;
  adminSubtitle: string;
  logo: string | null;
  colors: {
    primary: string;
    accent: string;
    header: string;
    nav: string;
    navActive: string;
  };
};

export type InstitutionResponse = Omit<InstitutionBrand, "logo"> & {
  logoUrl: string | null;
};

export const institutionBrand: InstitutionBrand = {
  slug: "cimol",
  name: "CIMOL",
  adminName: "CIMOL Admin",
  systemName: "Sistema de Gestão Escolar",
  adminSubtitle: "Painel Administrativo",
  logo: cimolLogo,
  colors: {
    primary: "228 65% 48%",
    accent: "45 100% 51%",
    header: "228 62% 32%",
    nav: "228 62% 42%",
    navActive: "228 50% 52%",
  },
};

let cachedBrand = institutionBrand;
let pendingBrand: Promise<InstitutionBrand> | null = null;

const setThemeColor = (name: string, value: string) => {
  if (!/^\d{1,3}(?:\.\d+)?\s+\d{1,3}(?:\.\d+)?%\s+\d{1,3}(?:\.\d+)?%$/.test(value)) return;
  document.documentElement.style.setProperty(name, value);
};

const applyInstitutionTheme = (brand: InstitutionBrand) => {
  setThemeColor("--primary", brand.colors.primary);
  setThemeColor("--ring", brand.colors.primary);
  setThemeColor("--accent", brand.colors.accent);
  setThemeColor("--header-bg", brand.colors.header);
  setThemeColor("--nav-bg", brand.colors.nav);
  setThemeColor("--nav-active", brand.colors.navActive);
};

const toInstitutionBrand = (data: InstitutionResponse): InstitutionBrand => ({
  ...data,
  logo: data.logoUrl || (data.slug === "cimol" ? cimolLogo : null),
});

export const setInstitutionBrand = (data: InstitutionResponse) => {
  cachedBrand = toInstitutionBrand(data);
  applyInstitutionTheme(cachedBrand);
  return cachedBrand;
};

const loadInstitutionBrand = async () => {
  if (pendingBrand) return pendingBrand;
  pendingBrand = apiFetch<InstitutionResponse>("/api/instituicao").then((data) => {
    return setInstitutionBrand(data);
  }).catch((error) => {
    pendingBrand = null;
    throw error;
  });
  return pendingBrand;
};

export const selectInstitutionSlug = (slug: string) => {
  window.localStorage.setItem(INSTITUTION_SLUG_STORAGE_KEY, slug);
  cachedBrand = institutionBrand;
  pendingBrand = null;
};

export const useInstitutionBrand = () => {
  const [brand, setBrand] = useState(cachedBrand);

  useEffect(() => {
    let active = true;
    loadInstitutionBrand()
      .then((loadedBrand) => {
        if (active) setBrand(loadedBrand);
      })
      .catch(() => null);
    return () => {
      active = false;
    };
  }, []);

  return brand;
};
