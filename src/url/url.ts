import { BehaviorSubject } from "rxjs";

export interface ReactiveSearchParam<T> {
  value$: BehaviorSubject<T>;
  set: (value: T) => void;
  replace: (value: T) => void;
}
export function useSearchParam<T = string>(options: {
  name: string;
  initialValue: T;
  codec?: {
    encode: (value: T) => string;
    decode: (value: string) => T;
  };
}): ReactiveSearchParam<T> {
  const { name, initialValue, codec } = options;

  const defaultCodec = {
    encode: (value: T) => encodeURIComponent(String(value)),
    decode: (value: string) => decodeURIComponent(value) as T,
  };

  const { encode, decode } = codec || defaultCodec;

  const searchParams = new URLSearchParams(window.location.search);
  const urlValue = searchParams.get(name);
  const parsedValue = urlValue ? decode(urlValue) : initialValue;
  const value$ = new BehaviorSubject<T>(parsedValue);

  const updateURL = (value: T, replaceState = false) => {
    const url = new URL(window.location.href);
    if (value === null || value === initialValue) {
      url.searchParams.delete(name);
    } else {
      url.searchParams.set(name, encode(value));
    }

    if (replaceState) {
      window.history.replaceState({}, "", url.toString());
    } else {
      window.history.pushState({}, "", url.toString());
    }
  };

  // Listen to popstate events to sync with browser back/forward
  window.addEventListener("popstate", () => {
    const searchParams = new URLSearchParams(window.location.search);
    const currentValue = searchParams.get(name);
    const parsedCurrentValue = currentValue ? decode(currentValue) : initialValue;
    value$.next(parsedCurrentValue);
  });

  return {
    value$,
    set: (value: T) => {
      value$.next(value);
      updateURL(value, false);
    },
    replace: (value: T) => {
      value$.next(value);
      updateURL(value, true);
    },
  };
}
