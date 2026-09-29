I will now generate a highly detailed Product Requirements Document (PRD) along with the complete Node.js implementation. This will be divided into two files: a comprehensive Markdown document acting as your PRD, and a complete, deployable Node.js server file.


I have generated the in-depth PRD document encompassing the architecture, logic flows, LLM prompt injections, and exact mapping rules, alongside the complete Node.js codebase.

The API code natively handles India Standard Time (IST) using `date-fns-tz` to ensure that midnight rollovers in India do not cause the 7-day calculation window to break on your servers (which often run on UTC).