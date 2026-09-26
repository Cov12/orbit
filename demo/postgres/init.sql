-- One server, one database per app. Portal and Drive share `portal` (Portal owns the schema).
CREATE DATABASE portal;
CREATE DATABASE workpipe;
CREATE DATABASE conductor;
