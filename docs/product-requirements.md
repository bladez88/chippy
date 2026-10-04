# Product requirements

Chippy coordinates travel between existing friends rather than operating a public rideshare marketplace. The primary flow is create an account or sign in with email/password (with Google as an optional convenience), create a one-time or recurring trip, find a friend overlap, request a ride, accept it, and see the confirmed carpool.

Calendar is the home screen with day, week, and month views. Headings use three-letter month names on phones and full month names on wider screens. Week headings describe the complete visible date range, including both month names when the range crosses a boundary. Mobile week cards always show their departure time. Users can search and select multiple accepted friends to compare privacy-safe schedule blocks. Each selected friend gets a clearly separated, stable palette color shown only on their name label, while event cards remain visually neutral. A floating bottom pill provides Calendar, Map, and Menu. Mobile interactions use bottom sheets; wider screens use dialog/popover layouts. The PWA caches its static shell but does not cache private API data or queue offline writes.

A potential carpool may qualify through a close departure window or a close destination-arrival window. Match details compare the passenger's original arrival with the estimated carpool arrival and explicitly state how many minutes earlier or later the passenger would arrive.

Changing transportation mode recalculates the displayed route duration and route geometry through the selected backend routing adapter. Route durations are estimates and use a `~` label. Driving, walking, and cycling use provider-specific profiles; transit remains an approximation until a live timetable-capable transit provider is integrated.

After a ride request is accepted, both participants' calendar cards present the trip as **Carpooling** while retaining each participant's original transportation mode in the underlying trip snapshot. Confirmed calendar cards omit the redundant passenger-count badge; passenger totals remain available in trip details.

Users can edit the date, departure time, transportation mode, carpool intent, and available seats for one dated trip occurrence. If a confirmed driver changes coordination-relevant details or stops driving, confirmed passengers are removed, their original trips are restored, and they receive in-app notifications.

MVP excludes real payments, live GPS/navigation, push/SMS/email, public discovery, friend groups, machine learning, and complex route optimization.
