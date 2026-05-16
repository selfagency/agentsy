import { describe, expect, expectTypeOf, it, vi } from "vitest";

import { createInMemoryPubSubManager } from "./pub-sub-manager.js";

describe("PubSubManager", () => {
	describe("subscribe", () => {
		it("should register a listener and return an unsubscribe function", () => {
			const manager = createInMemoryPubSubManager();
			const listener = vi.fn<() => void>();

			const unsubscribe = manager.subscribe("test-channel", listener);

			expectTypeOf(unsubscribe).toBeFunction();
			expect(manager.subscriberCount("test-channel")).toBe(1);
		});

		it("should support multiple listeners on the same channel", () => {
			const manager = createInMemoryPubSubManager();
			const listener1 = vi.fn<() => void>();
			const listener2 = vi.fn<() => void>();
			const listener3 = vi.fn<() => void>();

			manager.subscribe("channel1", listener1);
			manager.subscribe("channel1", listener2);
			manager.subscribe("channel1", listener3);

			expect(manager.subscriberCount("channel1")).toBe(3);
		});

		it("should support listeners on different channels", () => {
			const manager = createInMemoryPubSubManager();
			const listener1 = vi.fn<() => void>();
			const listener2 = vi.fn<() => void>();

			manager.subscribe("channel1", listener1);
			manager.subscribe("channel2", listener2);

			expect(manager.subscriberCount("channel1")).toBe(1);
			expect(manager.subscriberCount("channel2")).toBe(1);
		});

		it("should allow the same listener to subscribe to multiple channels", () => {
			const manager = createInMemoryPubSubManager();
			const listener = vi.fn<() => void>();

			manager.subscribe("channel1", listener);
			manager.subscribe("channel2", listener);

			expect(manager.subscriberCount("channel1")).toBe(1);
			expect(manager.subscriberCount("channel2")).toBe(1);
		});
	});

	describe("unsubscribe", () => {
		it("should remove a listener when unsubscribe is called", () => {
			const manager = createInMemoryPubSubManager();
			const listener = vi.fn<() => void>();

			const unsubscribe = manager.subscribe("test-channel", listener);
			expect(manager.subscriberCount("test-channel")).toBe(1);

			unsubscribe();
			expect(manager.subscriberCount("test-channel")).toBe(0);
		});

		it("should remove only the unsubscribed listener, keeping others", () => {
			const manager = createInMemoryPubSubManager();
			const listener1 = vi.fn<() => void>();
			const listener2 = vi.fn<() => void>();
			const listener3 = vi.fn<() => void>();

			manager.subscribe("channel1", listener1);
			const unsubscribeListener2 = manager.subscribe("channel1", listener2);
			manager.subscribe("channel1", listener3);

			unsubscribeListener2();

			expect(manager.subscriberCount("channel1")).toBe(2);
		});

		it("should clean up channel when all listeners unsubscribe", () => {
			const manager = createInMemoryPubSubManager();
			const listener = vi.fn<() => void>();

			const unsubscribe = manager.subscribe("test-channel", listener);
			unsubscribe();

			// Channel should be removed, so subscriberCount returns 0
			expect(manager.subscriberCount("test-channel")).toBe(0);
		});

		it("should be safe to call unsubscribe multiple times", () => {
			const manager = createInMemoryPubSubManager();
			const listener = vi.fn<() => void>();

			const unsubscribe = manager.subscribe("test-channel", listener);
			unsubscribe();

			// Should not throw
			expect(() => {
				unsubscribe();
			}).not.toThrow();
		});
	});

	describe("publish", () => {
		it("should deliver payload to all subscribers", async () => {
			const manager = createInMemoryPubSubManager();
			const listener1 = vi.fn<(payload: unknown) => void>();
			const listener2 = vi.fn<(payload: unknown) => void>();
			const listener3 = vi.fn<(payload: unknown) => void>();

			manager.subscribe("test-channel", listener1);
			manager.subscribe("test-channel", listener2);
			manager.subscribe("test-channel", listener3);

			const payload = { message: "test payload" };
			await manager.publish("test-channel", payload);

			expect(listener1).toHaveBeenCalledWith(payload);
			expect(listener2).toHaveBeenCalledWith(payload);
			expect(listener3).toHaveBeenCalledWith(payload);
			expect(listener1).toHaveBeenCalledOnce();
			expect(listener2).toHaveBeenCalledOnce();
			expect(listener3).toHaveBeenCalledOnce();
		});

		it("should not deliver to listeners on different channels", async () => {
			const manager = createInMemoryPubSubManager();
			const listener1 = vi.fn<(payload: unknown) => void>();
			const listener2 = vi.fn<(payload: unknown) => void>();

			manager.subscribe("channel1", listener1);
			manager.subscribe("channel2", listener2);

			await manager.publish("channel1", { data: "test" });

			expect(listener1).toHaveBeenCalledWith();
			expect(listener2).not.toHaveBeenCalled();
		});

		it("should do nothing when publishing to a channel with no listeners", async () => {
			const manager = createInMemoryPubSubManager();

			// Should not throw
			await expect(
				manager.publish("non-existent-channel", { data: "test" }),
			).resolves.toBeUndefined();
		});

		it("should deliver multiple payloads in sequence", async () => {
			const manager = createInMemoryPubSubManager();
			const listener = vi.fn<(payload: unknown) => void>();

			manager.subscribe("test-channel", listener);

			const payload1 = { id: 1, message: "first" };
			const payload2 = { id: 2, message: "second" };
			const payload3 = { id: 3, message: "third" };

			await manager.publish("test-channel", payload1);
			await manager.publish("test-channel", payload2);
			await manager.publish("test-channel", payload3);

			expect(listener).toHaveBeenNthCalledWith(1, payload1);
			expect(listener).toHaveBeenNthCalledWith(2, payload2);
			expect(listener).toHaveBeenNthCalledWith(3, payload3);
			expect(listener).toHaveBeenCalledTimes(3);
		});

		it("should not deliver to unsubscribed listeners", async () => {
			const manager = createInMemoryPubSubManager();
			const listener = vi.fn<(payload: unknown) => void>();

			const unsubscribe = manager.subscribe("test-channel", listener);
			unsubscribe();

			await manager.publish("test-channel", { data: "test" });

			expect(listener).not.toHaveBeenCalled();
		});

		it("should support complex payload types", async () => {
			const manager = createInMemoryPubSubManager();
			const listener = vi.fn<(payload: unknown) => void>();

			manager.subscribe("test-channel", listener);

			const complexPayload = {
				array: [1, 2, 3],
				id: "test-123",
				nested: { level1: { level2: "value" } },
				timestamp: Date.now(),
			};

			await manager.publish("test-channel", complexPayload);

			expect(listener).toHaveBeenCalledWith(complexPayload);
		});
	});

	describe("subscriberCount", () => {
		it("should return 0 for non-existent channel", () => {
			const manager = createInMemoryPubSubManager();
			expect(manager.subscriberCount("non-existent")).toBe(0);
		});

		it("should track subscriber count accurately", () => {
			const manager = createInMemoryPubSubManager();
			const listener1 = vi.fn<() => void>();
			const listener2 = vi.fn<() => void>();
			const listener3 = vi.fn<() => void>();

			expect(manager.subscriberCount("channel")).toBe(0);

			const unsub1 = manager.subscribe("channel", listener1);
			expect(manager.subscriberCount("channel")).toBe(1);

			const unsub2 = manager.subscribe("channel", listener2);
			expect(manager.subscriberCount("channel")).toBe(2);

			const unsub3 = manager.subscribe("channel", listener3);
			expect(manager.subscriberCount("channel")).toBe(3);

			unsub1();
			expect(manager.subscriberCount("channel")).toBe(2);

			unsub2();
			expect(manager.subscriberCount("channel")).toBe(1);

			unsub3();
			expect(manager.subscriberCount("channel")).toBe(0);
		});
	});

	describe("Integration scenarios", () => {
		it("should handle subscribe, publish, unsubscribe cycle", async () => {
			const manager = createInMemoryPubSubManager();
			const listener = vi.fn<(payload: unknown) => void>();

			const unsub = manager.subscribe("events", listener);
			expect(manager.subscriberCount("events")).toBe(1);

			await manager.publish("events", { type: "event1" });
			expect(listener).toHaveBeenCalledOnce();

			unsub();
			expect(manager.subscriberCount("events")).toBe(0);

			await manager.publish("events", { type: "event2" });
			expect(listener).toHaveBeenCalledOnce(); // Still 1, not called for event2
		});

		it("should support fan-out pattern with many subscribers", async () => {
			const manager = createInMemoryPubSubManager();
			const listeners = Array.from({ length: 100 }, () =>
				vi.fn<(payload: unknown) => void>(),
			);

			listeners.forEach((listener) => {
				manager.subscribe("broadcast", listener);
			});

			const payload = { broadcast: true };
			await manager.publish("broadcast", payload);

			listeners.forEach((listener) => {
				expect(listener).toHaveBeenCalledWith(payload);
				expect(listener).toHaveBeenCalledOnce();
			});
		});

		it("should isolate channels completely", async () => {
			const manager = createInMemoryPubSubManager();
			const channel1Listener = vi.fn<(payload: unknown) => void>();
			const channel2Listener = vi.fn<(payload: unknown) => void>();

			manager.subscribe("channel1", channel1Listener);
			manager.subscribe("channel2", channel2Listener);

			await manager.publish("channel1", { source: "channel1" });

			expect(channel1Listener).toHaveBeenCalledOnce();
			expect(channel2Listener).toHaveBeenCalledTimes(0);
		});
	});
});
