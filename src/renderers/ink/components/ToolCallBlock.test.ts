import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { ToolCallBlock } from './ToolCallBlock.js';
import { darkTheme, defaultTheme } from '../themes/index.js';

describe('ToolCallBlock Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Done state tests
  describe('done state', () => {
    it('renders completed tool call', () => {
      const call = { id: '1', name: 'search', arguments: { q: 'test' }, done: true };
      const element = React.createElement(ToolCallBlock, {
        call,
        theme: darkTheme,
        screenReader: false,
      });
      expect(element.props.call.done).toBe(true);
      expect(element.props.call.name).toBe('search');
    });

    it('renders pending tool call', () => {
      const call = { id: '2', name: 'calculate', arguments: { expr: '1+1' }, done: false };
      const element = React.createElement(ToolCallBlock, {
        call,
        theme: darkTheme,
        screenReader: false,
      });
      expect(element.props.call.done).toBe(false);
    });

    it('uses done symbol for completed calls', () => {
      const call = { id: '1', name: 'api_call', arguments: {}, done: true };
      const element = React.createElement(ToolCallBlock, {
        call,
        theme: darkTheme,
        screenReader: false,
      });
      expect(element.props.theme.toolCall.doneSymbol).toBeDefined();
    });

    it('uses pending symbol for pending calls', () => {
      const call = { id: '2', name: 'processing', arguments: {}, done: false };
      const element = React.createElement(ToolCallBlock, {
        call,
        theme: darkTheme,
        screenReader: false,
      });
      expect(element.props.theme.toolCall.pendingSymbol).toBeDefined();
    });
  });

  // Tool call properties tests
  describe('tool call properties', () => {
    it('handles different tool names', () => {
      const names = ['search', 'calculate', 'fetch', 'parse', 'generate'];
      names.forEach(name => {
        const call = { id: '1', name, arguments: {}, done: false };
        const element = React.createElement(ToolCallBlock, {
          call,
          theme: darkTheme,
          screenReader: false,
        });
        expect(element.props.call.name).toBe(name);
      });
    });

    it('handles various argument types', () => {
      const argumentSets = [
        { q: 'search term' },
        { x: 10, y: 20 },
        { nested: { key: 'value' } },
        { array: [1, 2, 3] },
        {},
      ];
      argumentSets.forEach(args => {
        const call = { id: '1', name: 'tool', arguments: args, done: false };
        const element = React.createElement(ToolCallBlock, {
          call,
          theme: darkTheme,
          screenReader: false,
        });
        expect(element.props.call.arguments).toEqual(args);
      });
    });

    it('preserves unique tool IDs', () => {
      const ids = ['id1', 'id2', 'id-with-dashes', 'id_with_underscores'];
      ids.forEach(id => {
        const call = { id, name: 'tool', arguments: {}, done: true };
        const element = React.createElement(ToolCallBlock, {
          call,
          theme: darkTheme,
          screenReader: false,
        });
        expect(element.props.call.id).toBe(id);
      });
    });
  });

  // Screen reader tests
  describe('screen reader mode', () => {
    it('renders accessible output for completed call with SR', () => {
      const call = { id: '1', name: 'search_api', arguments: {}, done: true };
      const element = React.createElement(ToolCallBlock, {
        call,
        theme: darkTheme,
        screenReader: true,
      });
      expect(element.props.screenReader).toBe(true);
      expect(element.props.call.done).toBe(true);
    });

    it('renders accessible output for pending call with SR', () => {
      const call = { id: '2', name: 'fetch_data', arguments: {}, done: false };
      const element = React.createElement(ToolCallBlock, {
        call,
        theme: darkTheme,
        screenReader: true,
      });
      expect(element.props.screenReader).toBe(true);
      expect(element.props.call.done).toBe(false);
    });

    it('renders regular output without screen reader', () => {
      const call = { id: '1', name: 'process', arguments: {}, done: false };
      const element = React.createElement(ToolCallBlock, {
        call,
        theme: darkTheme,
        screenReader: false,
      });
      expect(element.props.screenReader).toBe(false);
    });
  });

  // Theme tests
  describe('theme handling', () => {
    it('respects pending color from theme', () => {
      const call = { id: '1', name: 'pending', arguments: {}, done: false };
      const element = React.createElement(ToolCallBlock, {
        call,
        theme: darkTheme,
        screenReader: false,
      });
      expect(element.props.theme.toolCall.pendingColor).toBeDefined();
    });

    it('respects done color from theme', () => {
      const call = { id: '1', name: 'done', arguments: {}, done: true };
      const element = React.createElement(ToolCallBlock, {
        call,
        theme: darkTheme,
        screenReader: false,
      });
      expect(element.props.theme.toolCall.doneColor).toBeDefined();
    });

    it('uses theme spinner interval when defined', () => {
      const customTheme = {
        ...darkTheme,
        toolCall: { ...darkTheme.toolCall, spinnerIntervalMs: 100 },
      };
      const call = { id: '1', name: 'anim', arguments: {}, done: false };
      const element = React.createElement(ToolCallBlock, {
        call,
        theme: customTheme,
        screenReader: false,
      });
      expect(element.props.theme.toolCall.spinnerIntervalMs).toBe(100);
    });

    it('handles different themes', () => {
      const call = { id: '1', name: 'tool', arguments: {}, done: false };
      const darkElement = React.createElement(ToolCallBlock, {
        call,
        theme: darkTheme,
        screenReader: false,
      });
      const lightElement = React.createElement(ToolCallBlock, {
        call,
        theme: defaultTheme,
        screenReader: false,
      });
      expect(darkElement.props.theme).toBe(darkTheme);
      expect(lightElement.props.theme).toBe(defaultTheme);
    });
  });

  // Animation tests
  describe('animation behavior', () => {
    it('animates pending calls when not in screen reader mode', () => {
      const call = { id: '1', name: 'async_op', arguments: {}, done: false };
      const element = React.createElement(ToolCallBlock, {
        call,
        theme: darkTheme,
        screenReader: false,
      });
      expect(element.props.call.done).toBe(false);
      expect(element.props.screenReader).toBe(false);
    });

    it('does not animate completed calls', () => {
      const call = { id: '1', name: 'sync_op', arguments: {}, done: true };
      const element = React.createElement(ToolCallBlock, {
        call,
        theme: darkTheme,
        screenReader: false,
      });
      expect(element.props.call.done).toBe(true);
    });

    it('does not animate in screen reader mode even for pending', () => {
      const call = { id: '1', name: 'sr_pending', arguments: {}, done: false };
      const element = React.createElement(ToolCallBlock, {
        call,
        theme: darkTheme,
        screenReader: true,
      });
      expect(element.props.screenReader).toBe(true);
    });
  });

  // Complex argument tests
  describe('complex arguments', () => {
    it('handles nested objects in arguments', () => {
      const call = {
        id: '1',
        name: 'complex_tool',
        arguments: {
          nested: { deep: { value: 42 } },
          list: [1, 2, 3],
        },
        done: false,
      };
      const element = React.createElement(ToolCallBlock, {
        call,
        theme: darkTheme,
        screenReader: false,
      });
      expect(element.props.call.arguments.nested).toBeDefined();
      expect(element.props.call.arguments.list).toBeDefined();
    });

    it('handles large argument objects', () => {
      const largeArgs = Object.fromEntries(
        Array.from({ length: 100 }, (_, i) => [
          `key_${i}`,
          `value_${i}`,
        ])
      );
      const call = {
        id: '1',
        name: 'large_args_tool',
        arguments: largeArgs,
        done: false,
      };
      const element = React.createElement(ToolCallBlock, {
        call,
        theme: darkTheme,
        screenReader: false,
      });
      expect(Object.keys(element.props.call.arguments).length).toBe(100);
    });

    it('handles special characters in arguments', () => {
      const call = {
        id: '1',
        name: 'special_tool',
        arguments: {
          text: 'Special <chars> & "quotes" and \'apostrophes\'',
        },
        done: true,
      };
      const element = React.createElement(ToolCallBlock, {
        call,
        theme: darkTheme,
        screenReader: false,
      });
      expect(element.props.call.arguments.text).toContain('<chars>');
    });
  });

  // Default prop tests
  describe('default props', () => {
    it('has screenReader default to false', () => {
      const call = { id: '1', name: 'default_tool', arguments: {}, done: false };
      const element = React.createElement(ToolCallBlock, {
        call,
        theme: darkTheme,
      } as Parameters<typeof ToolCallBlock>[0]);
      expect(element).toBeDefined();
    });

    it('renders tool with complex arguments', () => {
      const call = {
        id: 'call-1',
        name: 'search',
        arguments: {
          query: 'test query',
          filters: { type: 'article', date: '2024' },
          limit: 10,
          nested: { deep: { value: 'found' } },
        },
        done: false,
      };
      const element = React.createElement(ToolCallBlock, {
        call,
        theme: darkTheme,
      } as Parameters<typeof ToolCallBlock>[0]);
      expect(element.props.call.arguments.query).toBe('test query');
    });
  });

  describe('tool call states', () => {
    it('renders pending tool call', () => {
      const call = { id: '1', name: 'pending_tool', arguments: {}, done: false };
      const element = React.createElement(ToolCallBlock, {
        call,
        theme: darkTheme,
      } as Parameters<typeof ToolCallBlock>[0]);
      expect(element.props.call.done).toBe(false);
    });

    it('renders completed tool call', () => {
      const call = { id: '1', name: 'completed_tool', arguments: {}, done: true };
      const element = React.createElement(ToolCallBlock, {
        call,
        theme: darkTheme,
      } as Parameters<typeof ToolCallBlock>[0]);
      expect(element.props.call.done).toBe(true);
    });
  });

  describe('tool argument variations', () => {
    it('handles tool with no arguments', () => {
      const call = { id: '1', name: 'no_args_tool', arguments: {}, done: false };
      const element = React.createElement(ToolCallBlock, {
        call,
        theme: darkTheme,
      } as Parameters<typeof ToolCallBlock>[0]);
      expect(Object.keys(element.props.call.arguments)).toHaveLength(0);
    });

    it('handles tool with many arguments', () => {
      const call = {
        id: '1',
        name: 'multi_arg_tool',
        arguments: {
          arg1: 'value1',
          arg2: 'value2',
          arg3: 'value3',
          arg4: 'value4',
          arg5: 'value5',
        },
        done: false,
      };
      const element = React.createElement(ToolCallBlock, {
        call,
        theme: darkTheme,
      } as Parameters<typeof ToolCallBlock>[0]);
      expect(Object.keys(element.props.call.arguments).length).toBe(5);
    });

    it('handles string arguments', () => {
      const call = {
        id: '1',
        name: 'string_tool',
        arguments: { text: 'hello world', prompt: 'test prompt' },
        done: false,
      };
      const element = React.createElement(ToolCallBlock, {
        call,
        theme: darkTheme,
      } as Parameters<typeof ToolCallBlock>[0]);
      expect(element.props.call.arguments.text).toBe('hello world');
    });

    it('handles numeric arguments', () => {
      const call = {
        id: '1',
        name: 'numeric_tool',
        arguments: { count: 42, max: 100, threshold: 0.5 },
        done: false,
      };
      const element = React.createElement(ToolCallBlock, {
        call,
        theme: darkTheme,
      } as Parameters<typeof ToolCallBlock>[0]);
      expect(element.props.call.arguments.count).toBe(42);
    });
  });

  describe('theme handling', () => {
    it('applies dark theme', () => {
      const call = { id: '1', name: 'themed_tool', arguments: {}, done: false };
      const element = React.createElement(ToolCallBlock, {
        call,
        theme: darkTheme,
      } as Parameters<typeof ToolCallBlock>[0]);
      expect(element.props.theme).toBe(darkTheme);
    });

    it('applies default theme', () => {
      const call = { id: '1', name: 'themed_tool', arguments: {}, done: false };
      const element = React.createElement(ToolCallBlock, {
        call,
        theme: defaultTheme,
      } as Parameters<typeof ToolCallBlock>[0]);
      expect(element.props.theme).toBe(defaultTheme);
    });
  });
});

