export interface State {
  name: string;
  acceptables?: string[];
  default?: string;
  ignore?: boolean;
}

export interface Macro {
  name: string;
  action: string;
  visibleto?: string;
}
