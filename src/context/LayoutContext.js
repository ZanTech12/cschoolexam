import { createContext, useContext, useState, useCallback } from 'react';

const LayoutContext = createContext(null);

export function LayoutProvider({ children }) {
  const [layoutHidden, setLayoutHidden] = useState(false);

  const hideLayout = useCallback(() => setLayoutHidden(true), []);
  const showLayout = useCallback(() => setLayoutHidden(false), []);

  return (
    <LayoutContext.Provider value={{ layoutHidden, hideLayout, showLayout }}>
      {children}
    </LayoutContext.Provider>
  );
}

export function useLayout() {
  const context = useContext(LayoutContext);
  if (!context) {
    throw new Error('useLayout must be used within a LayoutProvider');
  }
  return context;
}

export default LayoutContext;