// context/DeviceContext.jsx
import React, { createContext, useContext } from 'react';
import { useMediaQuery } from 'react-responsive';

const DeviceContext = createContext();

export const DeviceProvider = ({ children }) => {
  const isMobile = useMediaQuery({ maxWidth: 767 });
  const isDesktop = useMediaQuery({ minWidth: 768 });

  return (
    <DeviceContext.Provider value={{ isMobile, isDesktop }}>
      {children}
    </DeviceContext.Provider>
  );
};

// Custom hook to use it easily in your components
export const useDevice = () => {
  return useContext(DeviceContext);
};