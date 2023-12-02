import { mock } from "jest-mock-extended";

import { AsyncMutationObserver } from "../src/utilities/AsyncMutationObserver";
import { Reddit, RedditPost } from "../src/reddit/Reddit";
import { RedditExpandedCommunityFilter } from "../src/RedditExpandedCommunityFilter";
import { RedditSession } from "../src/reddit/RedditSession";
import { Storage } from "../src/userscript/Storage";

describe("RedditExpandedCommunityFilter", () => {
    let mockMutationObserver: ReturnType<typeof mock<MutationObserver>>;
    let mockReddit: ReturnType<typeof mock<Reddit>>;
    let mockRedditSession: ReturnType<typeof mock<RedditSession>>;
    let mockStorage: ReturnType<typeof mock<Storage>>;
    let mutationObserverSupplier: jest.Mock<MutationObserver, [MutationCallback], any>;
    let redditExpandedCommunityFilter: RedditExpandedCommunityFilter;
    let TestAsyncMutationObserver: typeof AsyncMutationObserver;
    let TestRedditExpandedCommunityFilter: typeof RedditExpandedCommunityFilter;

    beforeEach(() => {
        mockMutationObserver = mock<MutationObserver>();
        mutationObserverSupplier = jest.fn().mockReturnValue(mockMutationObserver);

        mockReddit = mock<Reddit>();
        mockReddit.getMutedPosts.mockReturnValue(Promise.resolve([]));

        mockRedditSession = mock<RedditSession>();
        mockRedditSession.updateAccessToken.mockReturnValue(Promise.resolve("access token"));
        mockRedditSession.updateMutedSubreddits.mockReturnValue(Promise.resolve([]));
        mockRedditSession.getAccessToken.mockImplementation(mockRedditSession.updateAccessToken);
        mockRedditSession.getMutedSubreddits.mockImplementation(mockRedditSession.updateMutedSubreddits);

        mockStorage = mock<Storage>();
        mockStorage.get.mockReturnValue(false);

        TestAsyncMutationObserver = class extends AsyncMutationObserver {
            protected mutationObserverSupplier(callback: MutationCallback): MutationObserver {
                return mutationObserverSupplier(callback);
            }
        };

        TestRedditExpandedCommunityFilter = class extends RedditExpandedCommunityFilter {
            protected addStyle(): HTMLStyleElement {
                return mock<HTMLStyleElement>();
            }

            protected asyncMutationObserverSupplier(callback: MutationCallback): AsyncMutationObserver {
                return new TestAsyncMutationObserver(callback);
            }

            protected redditSupplier(): Reddit {
                return mockReddit;
            }

            protected redditSessionSupplier(): RedditSession {
                return mockRedditSession;
            }

            protected storageSupplier(): Storage {
                return mockStorage;
            }
        };

        redditExpandedCommunityFilter = new TestRedditExpandedCommunityFilter();
    });

    test("stop should resolve immediately if not started", async () => {
        await redditExpandedCommunityFilter.stop();
    });

    test("start should return the same promise", () => {
        const startPromise1 = redditExpandedCommunityFilter.start();
        const startPromise2 = redditExpandedCommunityFilter.start();
        expect(startPromise2).toBe(startPromise1);
    });

    test("should get updated access token immediately", () => {
        redditExpandedCommunityFilter.start();
        expect(mockRedditSession.updateAccessToken.mock.calls).toHaveLength(1);
    });

    test("should get updated muted subreddits immediately", () => {
        redditExpandedCommunityFilter.start();
        expect(mockRedditSession.updateMutedSubreddits.mock.calls).toHaveLength(1);
    });

    describe("on mutation update", () => {
        let mutationObserverCallback: MutationCallback;
        let mutationRecord: MutationRecord;
        let redditPost: {
            container: {
                classList: {
                    add: ReturnType<typeof jest.fn>
                    contains: ReturnType<typeof jest.fn>
                },
                remove: ReturnType<typeof jest.fn>
            },
            subreddit: string
        };

        let startPromise: Promise<void>;

        beforeEach(async () => {
            redditPost = {
                container: {
                    classList: {
                        add: jest.fn(),
                        contains: jest.fn().mockReturnValue(false)
                    },
                    remove: jest.fn()
                },
                subreddit: "/r/all"
            };

            mutationRecord = {
                addedNodes: [{
                    childNodes: [{
                        nodeType: Node.ELEMENT_NODE
                    }] as unknown as NodeList,
                    parentElement: {},
                    parentNode: {}
                }] as unknown as NodeList,
                attributeName: null,
                attributeNamespace: null,
                nextSibling: null,
                oldValue: null,
                previousSibling: null,
                removedNodes: [] as unknown as NodeList,
                target: {} as Node,
                type: "childList"
            };

            startPromise = redditExpandedCommunityFilter.start();
            await new Promise<void>((resolve) => {
                mockMutationObserver.observe.mockImplementation(() => resolve());
            });

            mutationObserverCallback = mutationObserverSupplier.mock.calls[0][0];
        });

        test("should get muted posts", async () => {
            expect(mockReddit.getMutedPosts.mock.calls).toHaveLength(0);
            await mutationObserverCallback([mutationRecord], mockMutationObserver);
            expect(mockReddit.getMutedPosts.mock.calls).toHaveLength(1);
        });

        test("promise should resolve on stop", async () => {
            redditExpandedCommunityFilter.stop();
            await startPromise;
        });

        test("should remove muted post", async () => {
            mockReddit.getMutedPosts.mockReturnValue(Promise.resolve([redditPost as unknown as RedditPost]));
            await mutationObserverCallback([mutationRecord], mockMutationObserver);
            expect(redditPost.container.remove.mock.calls).toHaveLength(1);
        });

        test("should not remove muted post if debug mode enabled", async () => {
            mockStorage.get.mockReturnValue(true);
            mockReddit.getMutedPosts.mockReturnValue(Promise.resolve([redditPost as unknown as RedditPost]));
            await mutationObserverCallback([], mockMutationObserver);
            expect(redditPost.container.remove.mock.calls).toHaveLength(0);
        });
    });

    test("promise should resolve on stop", async () => {
        const promise = redditExpandedCommunityFilter.start();
        redditExpandedCommunityFilter.stop();
        await promise;
    });
});