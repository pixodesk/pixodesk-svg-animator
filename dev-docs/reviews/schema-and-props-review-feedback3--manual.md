Issues/questions:

- What is this for - playLevelsOf? And why it is so strangely named?


Maybe it is alright, maybe not...
Action behaviour values - it is hard to think about them... any alternatives?:
    start: [continue, restart, jumpToEnd]
    stop: [reset, rewind] - on stop we go back to start, which way?
    finish: [hold, reset, rewind] - when we finish we either stay where we finish or go back to start (which way?)
    outOfView: [pause, continue, reset] - either we stay where we out of view or continue playing or 

- where do we need jumpToEnd?


Maybe it is fine, just thoughts:
"current" - it is "time withing iteration", "current" doesn't imply that
and "total time" sounds as duration, but implies elapsed time or you could also say "current" time...

something like: getIterationProgress(), getIterationTime()
or it would be too unconventional?

e.g. we have getCurrentIteration() sounds good... so it all needs to have consistent name parts...

plus, you would normally think in terms of one iteration... and rarely use all ellspsed time... so the base option - withing iteration needs to take simplest form...
although it was nice to use a prefix to show relation between attrs/functions/methods....

Also play vs playback:
playSpeed/playTime/playDuration vs playbackSpeed/playbackTime/playbackDuration... - more grammatically correct? anywhere else?

====

then we are missing - getCurrentPlayTime(), getTotalPlayTime()
and what is getTotalDuration() and getTotalPlayDuration() - it doesn't make sense!±

===

PxDiagnostic - what is it for?

===

what is onAnimationPlayersChange() for, where used?

===

animator.definitions - names - all good, all make sense?

===

whenIdle is strange namd... and i am not sure that on animation off we need to return to static form... is there something like this in css keyframe animation or waapi... i think yes... what is it animation fill attr or something like this?

