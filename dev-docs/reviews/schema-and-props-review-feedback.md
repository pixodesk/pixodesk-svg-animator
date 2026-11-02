I've reviewed the whole brief, including the TypeScript definitions, examples, rationale, and the seven unresolved naming decisions.

My overall impression: the design is quite good, but there are several important inconsistencies that I would address before releasing 1.11. Interestingly, most problems aren't individual names being bad. They're places where the naming suggests one conceptual model, while the actual API implements a slightly different one.

I'm judging this primarily from the perspective of a developer familiar with JavaScript/TypeScript, React, SVG, CSS animations, WAAPI and animation editors, encountering the API for the first time.
1. Overall assessment
Conceptual model
Good

The separation between timeline, action triggers and action behaviour is sensible.
Vocabulary
Mostly good

Most names are recognizable and reasonably consistent with existing animation terminology.
Internal consistency
Needs work

Some keys don't follow the rules established by the schema itself.
React API
Needs work

There are a few unconventional props and surprising interactions between control modes.
First-read understandability
Room for improvement

Some names are understandable after learning the internal terminology, but aren't necessarily what an experienced developer would guess.
I would concentrate on the following issues, in order of importance.
2. Most important issues
2.1. actionTriggers and actions aren't quite as symmetrical as you claim
High priority
This is probably my biggest conceptual concern.

Your central principle is:
Triggers say WHEN, actions say HOW.

And you explain that the same key appears in both blocks.

However, look at the actual types:
interface PxActionTriggers {
    start?: PxTriggerEvents;
    stop?: PxTriggerEvents;
    pause?: PxTriggerEvents;
    resume?: PxTriggerEvents;
    togglePlay?: PxTriggerEvents;
}

interface PxActions {
    start?: PxStartTransition;
    stop?: PxStopTransition;
    finish?: PxFinishTransition;
    suspend?: PxSuspendTransition;
}


There are three different situations:
- start and stop have corresponding configurations in both objects.
- pause is triggerable but has no corresponding configuration in actions.
- togglePlay and resume aren't really configurable actions in the same sense.
Meanwhile, finish and suspend are configurable but aren't triggerable through actionTriggers.

This isn't necessarily wrong architecturally, but the conceptual explanation is misleading.

There are also two specific problems:

A. resume is accepted in the document schema but ignored.

I wouldn't expose a public schema property that the current implementation deliberately ignores.

The explanation that it might become useful for future element targets isn't sufficient justification. Future functionality can introduce it when it actually exists.

My recommendation: remove resume from the current document schema as well as the prop type.

B. togglePlay isn't really an action.

It's a shortcut that expands into two actions:
togglePlay: 'click'


is equivalent to:
start: 'click',
stop: 'click'


That's a perfectly reasonable convenience, but it doesn't fit the stated rule that keys represent actions.

I'd explicitly describe it as a special trigger shortcut rather than pretending it's another action.

I would keep actionTriggers and actions as names. The distinction is good. I'd just make the conceptual explanation more accurate.
animator-and-props-external-review.md
2.2. Document defaults versus React component defaults
High priority
This is a more serious problem than it initially appears.

Your document-level defaults say:
// No actionTriggers means:
start: 'load'


In other words, an animation document is designed to play by default.

But:
<SvgAnimationPlayer doc={ball} />


renders a static first frame and does not play.

You must explicitly write:
<SvgAnimationPlayer
    doc={ball}
    playUsingActionTriggers
/>


This is documented as intentional, to avoid accidentally animating hundreds of icons.

I understand the reasoning, but I think there is a conceptual inconsistency here.

The document is supposed to be a self-contained animation description, including how it plays. Yet the React component doesn't necessarily respect that description.

A developer might reasonably expect:
<SvgAnimationPlayer doc={animation} />


to play the animation according to its own configuration.

There are two legitimate approaches:
1. Document-driven by default: the player respects the document's configuration. Static rendering is an explicit mode.
2. Host-driven by default: the component is static unless the developer explicitly enables a playback driver.
Both are defensible. But I would choose one consistently across the web, React, Vue and React Native players.

Personally, I lean towards document-driven playback. It makes the document genuinely portable and self-contained.

If you retain static-by-default React behaviour, make it a very explicit part of the API contract rather than treating the document defaults as universal player defaults.

animator-and-props-external-review.md
animator-and-props-external-review.md

2.3. togglePlay is potentially misleading
High priority
Consider:
actionTriggers: {
    togglePlay: 'click'
}


Your implementation means:
- Stopped → start.
- Playing → stop.
- Paused → stop.
- Finished → stop.
However, in the UI/media world, toggle play is frequently understood as switching between playing and paused.

In other words, a developer might expect:
- Stopped → playing.
- Playing → paused.
- Paused → playing.
You actually have two different concepts:
- Toggle between playing and paused.
- Toggle between playing and stopped.
Your current name doesn't distinguish them.

I'd consider:
Name	Meaning
togglePlay	Ambiguous
togglePlayback	Still potentially ambiguous
toggleStartStop	Explicitly start/stop
togglePlayStop	Explicitly play/stop

My preference would be toggleStartStop, although it's less elegant.

Alternatively, remove the shortcut altogether. The explicit combination of start and stop is already understandable.
animator-and-props-external-review.md
2.4. suspend doesn't describe what actually happens
High priority
You use:
actions: {
    suspend: 'pause'
}


to configure what happens when an animation goes out of view.

I don't think suspend is the most intuitive word here.

For developers, suspension normally suggests something broader:
- A suspended application.
- A suspended process.
- A suspended browser/page.
- A suspended execution context.
Your actual condition is much more specific: the animation is outside the viewport.

You already have:
inViewThreshold
inViewDebounce


So I would consider using the same vocabulary.

For example:
actions: {
    outOfView: 'pause'
}


or:
actions: {
    offscreen: 'pause'
}


I slightly prefer outOfView because it directly corresponds to inView.

There is another small inconsistency:
suspend: 'continue'


Here continue means keep playing while suspended.

But in start: 'continue', it means continue from the current position.

These are different meanings for the same value.

I'd use something like keepPlaying for the visibility behaviour if you retain suspend.

animator-and-props-external-review.md
animator-and-props-external-review.md

2.5. The timeline prop is not really the same as the document's timeline
High priority
This is particularly important because the same name is used in two places.

In the document:
animator.timeline = {
    type,
    engine,
    inTime,
    outTime,
    playDuration,
    delay,
    iterations,
    actionTriggers,
    actions,
    ...
}


But the React prop:
<SvgAnimationPlayer
    timeline={{ iterations: 3 }}
/>


doesn't accept the complete timeline structure.

It excludes actionTriggers and actions, and it deep-merges the remaining settings.

Consequently, the two timeline objects aren't actually interchangeable.

This is a slight violation of a useful API principle:

If two properties have the same name, developers should generally expect them to represent the same concept and have the same structure.

I see three possibilities:
Name	My assessment
timeline	Good if it represents the actual timeline configuration
timelineOptions	Better if it represents a subset of configurable timeline settings
timelinePatch	Technically accurate, but unnecessarily implementation-oriented

My preference is timelineOptions if you retain the current separation.

I wouldn't use timing because the object contains more than timing information (engine, beforeStart, visibility settings, etc.).

There is also an important semantic issue:
- timeline merges.
- actions merges.
- playUsingActionTriggers replaces the complete trigger configuration.
This is not necessarily wrong, but it means three similarly shaped configuration objects have different merge semantics.

I would seriously consider making these rules more consistent, or at least making replacement versus merging obvious in the API design.

animator-and-props-external-review.md
animator-and-props-external-review.md

2.6. do is not a particularly good property name
Medium-high priority
Example:
actions: {
    stop: {
        do: 'rewind',
        completeIteration: true
    }
}


I understand your reasoning for rejecting transition.

However, do is extremely generic.

It doesn't tell the developer whether the property represents:
- A behaviour.
- An operation.
- A preset.
- A transition.
- An effect.
I'd prefer:
actions: {
    stop: {
        behavior: 'rewind',
        completeIteration: true
    }
}


Or potentially:
actions: {
    stop: {
        mode: 'rewind',
        completeIteration: true
    }
}


My preference is behavior.

It reads naturally:
- Stop behavior.
- Finish behavior.
- Start behavior.
It also doesn't introduce the CSS-specific meaning of transition.

I would definitely choose behavior over do or how.
animator-and-props-external-review.md
3. Other naming decisions
Here are my recommendations for the remaining names, including some that you haven't explicitly listed as doubts.
Current name	My recommendation	Reason
beforeStart	restingFrame	It also applies after reset, not just before the first start.
jumpToFinished	jumpToEnd	More natural English and familiar animation terminology.
onCancel	onReset	Should match reset().
getDuration	getIterationDuration	Currently returns one iteration, not the entire run.
target	selector	The value is '#hero', which is a selector rather than an ID.
version	schemaVersion	More explicit; avoids confusion with product/document versions.
doc	document	More self-explanatory, especially for a public component API.
playerRef	ref	React developers expect imperative handles through ref.
muteWarn	suppressWarnings	More natural and explicit.
muteError	suppressErrors	Same reasoning.

Some explanations are worth expanding.
beforeStart → restingFrame
Your current property:
beforeStart: 'static' | 'firstFrame'


actually defines the appearance of the animation when it is not running, including after a reset.

beforeStart suggests it only controls the initial appearance.

I'd use:
restingFrame: 'static' | 'firstFrame'


This is more descriptive of its actual purpose.
getDuration
You currently have:
getDuration()          // one iteration
getCurrentTime()       // entire run
getCurrentProgress()   // entire run


I find this inconsistent.

Someone familiar with animation APIs might reasonably assume getDuration() returns the total duration of the animation.

You could instead have:
getIterationDuration()
getTotalDuration()


Or make getDuration() return the total duration and introduce getIterationDuration() separately.

This deserves attention because it affects how developers implement scrubbers and progress indicators.
animator-and-props-external-review.md
inViewDebounce
This depends on the actual implementation.

If the meaning is:
The element must remain sufficiently visible for 150 ms before it counts as in view.

Then I'd consider:
inViewDelay: 150


debounce has a more specific meaning in JavaScript: suppressing repeated events until activity settles.

If you actually implement debouncing of visibility changes, keep inViewDebounce.
engine: 'native'
This is slightly problematic because the same API is intended for React, Vue and React Native.

In browser animation terminology, native could mean browser-native animation APIs.

In React Native, native could mean the native UI-thread animation driver.

If you specifically mean the Web Animations API, consider:
engine: 'auto' | 'waapi' | 'js'


That would be more precise for web developers. Whether it is appropriate across all platforms depends on what native actually means in each implementation.
iterationDirection
This is understandable, but I would question whether the extra word is necessary.

WAAPI developers already know:
direction: 'normal' | 'reverse' | 'alternate' | 'alternate-reverse'


You currently have:
iterationDirection: 'normal' | 'reverse' | 'alternate' | 'alternateReverse'


I would consider using the standard direction name and standard 'alternate-reverse' value.

The fact that another animation property might eventually have its own direction doesn't necessarily justify deviating from the established WAAPI terminology.
load
You explain that load means the animation document is ready, not that the page has loaded.

That's a reasonable implementation distinction, but it isn't what every developer will intuitively understand.

Consider:
actionTriggers: {
    start: 'ready'
}


Especially because you already have onReady.

I find ready more explicit in this particular context.

4. React component props
There are a few additional things I'd reconsider.
4.1. play and pause as two booleans
You already acknowledge this issue in the brief.
<SvgAnimationPlayer
    play={running}
    pause={frozen}
/>


It works, but two booleans represent three states:
- Stopped.
- Playing.
- Paused.
There are also invalid or confusing combinations.

For a public API, I think a single state property is conceptually cleaner:
<SvgAnimationPlayer playbackState="playing" />
<SvgAnimationPlayer playbackState="paused" />
<SvgAnimationPlayer playbackState="stopped" />


Or:
<SvgAnimationPlayer playback="playing" />


with the same three possible values.

My recommendation: I lean towards playbackState as the more explicit API.

However, I wouldn't underestimate the convenience of:
<SvgAnimationPlayer play={isHovered} />


This is an excellent React usage pattern.

One compromise would be to keep play as a convenient shorthand and introduce the state-based property as the more explicit alternative. But avoid having two competing ways of controlling the same thing unless there is a strong reason.
4.2. playerRef versus React's ref
I would use the standard React ref.
const playerRef = useRef<PxAnimationPlayerHandle>(null);

<SvgAnimationPlayer doc={animation} ref={playerRef} />


playerRef is understandable, but it is unconventional for React.

The fact that the ref exposes an imperative handle rather than the root SVG element isn't a reason to avoid ref. That's precisely what useImperativeHandle and forwardRef are designed for.
4.3. showAtProgress and showAtTime
I like these names.

In particular:
showAtProgress={0.5}
showAtTime={500}


They clearly communicate that the component should display a particular position without running the animation.

I would not change showAtTime to showAtMs.

Milliseconds are an established convention in WAAPI and many JavaScript animation APIs.

The only thing I'd ensure is that the documentation and types make the units extremely clear.
4.4. playUsingActionTriggers
I actually like this more than some alternatives.

It's long, but it communicates two important things:
1. This prop selects a playback driver.
2. That driver uses action triggers.
triggers alone would be too generic, and autoplay would be misleading.

One alternative worth considering is:
useActionTriggers


This is shorter and describes the selection of the trigger-based driver.

However, it loses the explicit connection to playback.

I would probably keep playUsingActionTriggers.

animator-and-props-external-review.md
animator-and-props-external-review.md

5. My assessment of your seven unresolved questions
Here is how I'd vote on the questions in §8.
#	My choice	Explanation
1. Empty object = manual	Keep	Empty configuration naturally means no events. A manual mode is more explicit but adds another special value.
2. play / pause	Consider changing	playbackState is conceptually cleaner, although play={boolean} is very convenient in React.
3. showAtTime	Keep	Milliseconds are established in the area. showAtMs looks worse.
4. timeline prop	Consider changing	timelineOptions is better if the prop intentionally accepts only part of the document timeline.
5. do	Change	behavior is considerably more self-explanatory.
6. jumpToFinished, suspend, load	Change some	jumpToEnd, outOfView and ready are worth considering.
7. onCancel	Change	onReset is the obvious choice.

A note on onFinish versus onEnded: I would retain onFinish if it means that the player entered its finished state, including through jumpToFinished(). If it is intended to mean only natural completion, onEnded or onComplete deserves consideration.
animator-and-props-external-review.md
6. Smaller inconsistencies worth fixing
These aren't necessarily reasons to redesign anything, but they're worth considering.

1. Cross-platform event vocabulary

You intend to share the same API between web, React, Vue and React Native.

However:
'hoverIn' | 'hoverOut' | 'click'


is quite web-oriented.

React Native developers are more familiar with press, while web developers expect click, pointerenter, pointerleave, etc.

You should decide whether these are deliberately abstract, platform-independent events or simply browser events with cross-platform implementations.

2. completeIteration

This is understandable, but:
completeIteration: true


could be interpreted as completing an iteration rather than delaying the stop until the current iteration completes.

Consider:
afterCurrentIteration: true


A little longer, but more explicit.

3. version

Your version number has three custom meanings:
- Format generation.
- Player schema revision.
- Editor extension.
This is not quite conventional semantic versioning.

I'd at least consider schemaVersion rather than version.

4. alternateReverse

If you want compatibility with WAAPI terminology, use the established hyphenated value:
'alternate-reverse'


rather than inventing a camel-cased enum value.

5. target

In:
{
    target: '#hero',
    animateWith: ['fadeIn']
}


the value is a CSS selector. selector or targetSelector would be more precise.

7. Names I would definitely keep
I don't think you should spend time endlessly reconsidering everything. There are many good decisions here.
Name	My opinion
animator	Good distinction from property-level animate and animations.
timeline (document)	Good, established animation terminology.
actionTriggers	Good and more descriptive than triggers.
actions	Good.
start / stop / pause / resume	Good conceptual vocabulary, subject to the schema issue above.
iterations	Excellent. Standard terminology.
delay	Excellent.
inTime / outTime	Good, especially for animation-editor users.
playDuration	Good. Explicitly distinguishes playback duration from content duration.
frameRate	Good.
rewind / reset / hold / restart	Excellent vocabulary.
definitions	Good.
bindings	Good.
animateWith	Reasonably intuitive.
showAtProgress	Very good.
showAtTime	Good.
playbackRate	Standard terminology.
onReady / onPlay / onPause	Good.


8. My recommended changes before release
If I were reviewing this API for release, I would prioritize these changes:
Definitely change
1. Remove the currently ignored resume schema property.
2. Rename onCancel to onReset.
3. Replace do with behavior.
4. Clarify the togglePlay semantics or rename it.
5. Reconcile the document defaults with the React component defaults.

Strongly consider
6. Rename beforeStart to restingFrame.
7. Replace suspend with a visibility-related term.
8. Reconsider timeline → timelineOptions on the component.
9. Reconsider getDuration because of its one-iteration semantics.
10. Use React's standard ref.
11. Decide whether playbackState would be a better control API.

Minor improvements
12. version → schemaVersion.
13. target → selector.
14. inViewDebounce → inViewDelay, if appropriate.
15. alternateReverse → alternate-reverse.

9. One more architectural observation
There is something I would think about beyond individual naming choices.

Your design has three different conceptual dimensions:
1. Timeline — what advances, its timing and its boundaries.
2. Triggers — what external events cause playback operations.
3. Actions — what happens when an operation is performed.
This is a good decomposition.

However, the API currently mixes some of these concepts:
- suspend is effectively a visibility policy.
- togglePlay is a compound operation.
- resume is derived from other triggers.
- finish is an internally generated lifecycle event.
- pause is an operation without configurable action behaviour.
I would make sure the conceptual model remains clean before adding custom actions, variables and element-targeted triggers.

Otherwise, future features will gradually introduce more exceptions to the current naming rules.

My final verdict: I would retain most of the vocabulary and the overall architecture. I wouldn't undertake a wholesale renaming. The biggest improvements would come from making the underlying concepts more consistent, particularly the relationship between triggers, actions, playback states and component control modes.

The goal should be that an experienced developer can look at something like:
animator: {
    timeline: {
        actionTriggers: {
            start: 'hoverIn',
            stop: 'hoverOut'
        },
        actions: {
            stop: 'rewind'
        }
    }
}


and understand not just the individual words, but the relationship between them without having to learn Pixodesk-specific terminology first.