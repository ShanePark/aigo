"use client";

import { useEffect } from "react";

import { clearMapLocationParamsForTextSearch } from "@/app/search-url-state";

export function SearchFormLocationReset() {
  useEffect(() => {
    const form = document.querySelector<HTMLFormElement>("form.search-form");
    if (!form) return;

    function handleFormData(event: FormDataEvent) {
      clearMapLocationParamsForTextSearch(event.formData, window.location.search);
    }

    form.addEventListener("formdata", handleFormData);
    return () => form.removeEventListener("formdata", handleFormData);
  }, []);

  return null;
}
