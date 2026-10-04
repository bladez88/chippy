# Product requirements

Chippy coordinates travel between existing friends rather than operating a public rideshare marketplace. The primary flow is login, create a one-time or recurring trip, find a friend overlap, request a ride, accept it, and see the confirmed carpool.

Calendar is the home screen with day, week, and month views. A floating bottom pill provides Calendar, Map, and Menu. Mobile interactions use bottom sheets; wider screens use dialog/popover layouts. The PWA caches its static shell but does not cache private API data or queue offline writes.

MVP excludes real payments, live GPS/navigation, push/SMS/email, public discovery, friend groups, machine learning, and complex route optimization.
