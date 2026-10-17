import { useState, useEffect, useRef } from 'react';
import { GamepadState } from '../../shared/types/session';

interface UseGamepadOptions {
  enabled?: boolean;
  deadzone?: number;
  onButtonPress?: (gamepadIndex: number, buttonIndex: number) => void;
  onAxisMove?: (gamepadIndex: number, axisIndex: number, value: number) => void;
}

export function useGamepad(options: UseGamepadOptions = {}) {
  const { enabled = true, deadzone = 0.15, onButtonPress, onAxisMove } = options;
  const [activeGamepad, setActiveGamepad] = useState<GamepadState | null>(null);
  const [connectedControllers, setConnectedControllers] = useState<string[]>([]);
  const animFrameRef = useRef<number | null>(null);
  const prevButtonsRef = useRef<boolean[]>([]);

  useEffect(() => {
    if (!enabled) return;

    const handleGamepadConnected = (e: GamepadEvent) => {
      console.log('[Gamepad] Control connected:', e.gamepad.id);
      updateControllersList();
    };

    const handleGamepadDisconnected = (e: GamepadEvent) => {
      console.log('[Gamepad] Control disconnected:', e.gamepad.id);
      updateControllersList();
    };

    window.addEventListener('gamepadconnected', handleGamepadConnected);
    window.addEventListener('gamepaddisconnected', handleGamepadDisconnected);

    updateControllersList();

    const pollGamepad = () => {
      const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
      let found: Gamepad | null = null;

      for (let i = 0; i < gamepads.length; i++) {
        const gp = gamepads[i];
        if (gp && gp.connected) {
          found = gp;
          break;
        }
      }

      if (found) {
        // Apply deadzone to axes
        const filteredAxes = found.axes.map((axisVal) => {
          return Math.abs(axisVal) < deadzone ? 0 : axisVal;
        });

        // Track button state transitions
        found.buttons.forEach((btn, idx) => {
          const wasPressed = prevButtonsRef.current[idx] || false;
          if (btn.pressed && !wasPressed) {
            onButtonPress?.(found.index, idx);
          }
          prevButtonsRef.current[idx] = btn.pressed;
        });

        filteredAxes.forEach((axisVal, idx) => {
          if (axisVal !== 0) {
            onAxisMove?.(found.index, idx, axisVal);
          }
        });

        setActiveGamepad({
          connected: true,
          id: found.id,
          index: found.index,
          mapping: found.mapping,
          axes: filteredAxes,
          buttons: found.buttons.map((b) => ({ pressed: b.pressed, value: b.value })),
        });
      } else {
        setActiveGamepad(null);
      }

      animFrameRef.current = requestAnimationFrame(pollGamepad);
    };

    animFrameRef.current = requestAnimationFrame(pollGamepad);

    return () => {
      window.removeEventListener('gamepadconnected', handleGamepadConnected);
      window.removeEventListener('gamepaddisconnected', handleGamepadDisconnected);
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [enabled, deadzone, onButtonPress, onAxisMove]);

  const updateControllersList = () => {
    const list: string[] = [];
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (let i = 0; i < gamepads.length; i++) {
      const gp = gamepads[i];
      if (gp && gp.connected) {
        list.push(gp.id);
      }
    }
    setConnectedControllers(list);
  };

  return {
    activeGamepad,
    connectedControllers,
    hasGamepad: connectedControllers.length > 0,
  };
}
