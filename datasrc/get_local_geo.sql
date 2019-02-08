WITH chambers_with_election_in_range AS (
SELECT  c.id, c.name_formal, c.official_count, c.election_frequency, c.term_length
  FROM webservice_chamber c
  LEFT JOIN webservice_official o ON c.id = o.chamber_id
 LEFT JOIN webservice_electionevent_chambers eec ON c.id = eec.chamber_id
 INNER JOIN webservice_electionevent ee ON eec.electionevent_id = ee.id
 INNER JOIN webservice_government g ON c.government_id = g.id
 INNER JOIN webservice_country s ON g.country_id = s.id
 WHERE o.trans_to IS null AND o.valid_to > now() AND c.trans_to IS null
 AND s.fips = 'US' AND g.type = 'LOCAL'
 AND ( ee.election_expire_date > '2018-10-01' AND ee.election_expire_date < '2019-01-01')
 GROUP BY c.id,  c.name_formal, c.official_count, c.election_frequency, c.term_length ),

district_poly_for_local AS (
SELECT c.name_formal, c.id, 
  ST_AsText(ST_SetSRID(j.mpoly, 4326)) as p_poly
  FROM webservice_official o
  INNER JOIN chambers_with_election_in_range c ON ( o.chamber_id = c.id )
  INNER JOIN webservice_district j ON ( o.district_id = j.id )
  WHERE 
  ( j.label = 'At Large' OR j.district_type_id = 6 ) AND 
  o.trans_to IS NULL
  GROUP BY c.name_formal, c.id,  j.mpoly
),


district_centroids_for_local AS (
SELECT c.name_formal, c.id, j.district_type_id,
  ST_Centroid(ST_SetSRID(j.mpoly, 4326)) as p_poly  
  FROM webservice_official o
  INNER JOIN chambers_with_election_in_range c ON ( o.chamber_id = c.id )
  INNER JOIN webservice_district j ON ( o.district_id = j.id )
  WHERE    o.trans_to IS NULL
  GROUP BY c.name_formal, c.id, j.district_type_id , j.mpoly
),

local_poly AS (
SELECT A.id, A.name_formal,
(SELECT B.p_poly FROM district_poly_for_local B WHERE B.id = A.id LIMIT 1) AS geo
FROM chambers_with_election_in_range A ),

local_centroid AS (
SELECT A.id, A.name_formal,
(SELECT B.p_poly FROM district_centroids_for_local B WHERE B.id = A.id LIMIT 1) AS geo
FROM chambers_with_election_in_range A )

SELECT id, name_formal, ST_X(geo) as lon, ST_Y(geo) as lat FROM local_centroid WHERE geo != ''
--SELECT COUNT(*) FROM local_poly WHERE geo != ''

