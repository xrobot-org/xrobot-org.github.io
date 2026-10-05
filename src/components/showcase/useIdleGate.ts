import { useMemo } from 'react';
import { UserIdle, idleProps, type IdleProps } from './autoplay';

/** one UserIdle per widget instance plus the event props to spread on the element that holds its controls */
export function useIdleGate(): { idle: UserIdle; props: IdleProps } {
  return useMemo(() => {
    const idle = new UserIdle();
    return { idle, props: idleProps(idle) };
  }, []);
}
