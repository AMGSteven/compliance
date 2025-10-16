declare module 'react-usa-map' {
  import { ComponentType } from 'react';

  interface StateConfig {
    fill?: string;
    clickHandler?: (event: any) => void;
  }

  interface USAMapProps {
    customize?: { [stateCode: string]: StateConfig };
    width?: string | number;
    height?: string | number;
    defaultFill?: string;
    onClick?: (event: any) => void;
    onMouseOver?: (event: any) => void;
  }

  const USAMap: ComponentType<USAMapProps>;
  export default USAMap;
}
