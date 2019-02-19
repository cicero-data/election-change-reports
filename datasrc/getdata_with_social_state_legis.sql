WITH chambers_with_election_in_range AS (
SELECT  c.id, g.state, c.level, c.name_formal, c.official_count, c.election_frequency, c.term_length
  FROM webservice_chamber c
  LEFT JOIN webservice_official o ON c.id = o.chamber_id
 LEFT JOIN webservice_electionevent_chambers eec ON c.id = eec.chamber_id
 INNER JOIN webservice_electionevent ee ON eec.electionevent_id = ee.id
 INNER JOIN webservice_government g ON c.government_id = g.id
 INNER JOIN webservice_country s ON g.country_id = s.id
 INNER JOIN webservice_roleandlevel rl ON rl.official_id = o.id
 WHERE o.trans_to IS null AND o.valid_to > now() AND c.trans_to IS null
 AND c.level = 'administrativeArea1' AND (rl.role = 'legislatorLowerBody' OR rl.role = 'legislatorUpperBody')
 AND s.fips = 'US' AND ( ee.election_expire_date > '2018-10-01' AND ee.election_expire_date < '2019-01-01')
 GROUP BY c.id, g.state, c.level , c.name_formal, c.official_count, c.election_frequency, c.term_length ),


cur_dem AS  (
SELECT * FROM webservice_official o
WHERE o.trans_to IS null AND o.valid_to > now() AND o.party = 'Democrat'
  ),
cur_rep AS  (
SELECT * FROM webservice_official o
WHERE o.trans_to IS null AND o.valid_to > now() AND o.party = 'Republican'
  ),
old_dem AS  (
SELECT * FROM webservice_official o
WHERE o.trans_to IS null AND o.valid_to > now() AND o.valid_from < '2018-11-08' AND o.party = 'Democrat'
  ),
old_rep AS  (
SELECT * FROM webservice_official o
WHERE o.trans_to IS null AND o.valid_to > now() AND o.valid_from < '2018-11-08' AND o.party = 'Republican'
  ),
ret_off AS  (
SELECT * FROM webservice_official o
WHERE o.trans_to IS null AND o.valid_to > now() AND o.valid_from < '2018-11-08' 
  ),
web_for AS  (
SELECT * FROM webservice_official o
WHERE o.trans_to IS null AND o.valid_to > now() AND o.web_form_url != ''
  ),
ema_ily AS  (
SELECT * FROM webservice_official o
WHERE o.trans_to IS null AND o.valid_to > now() AND (o.email_1 != '' OR o.email_2 != '')
  ),

has_fbs AS  (
SELECT A.*,
(SELECT COUNT(*) FROM webservice_identifier B WHERE B.official_id = A.id 
AND (B.identifier_type='FACEBOOK' OR B.identifier_type='FACEBOOK-CAMPAIGN' OR B.identifier_type='FACEBOOK-OFFICIAL' )
) AS tot
  FROM webservice_official A
WHERE A.trans_to IS null AND A.valid_to > now() 
  ),

has_twi AS  (
SELECT A.*,
(SELECT COUNT(*) FROM webservice_identifier B WHERE B.official_id = A.id 
AND (B.identifier_type='TWITTER'  )
) AS tot
  FROM webservice_official A
WHERE A.trans_to IS null AND A.valid_to > now() 
  )


SELECT A.*, 
(SELECT COUNT(*) FROM cur_dem B WHERE B.chamber_id = A.id) AS cdem_tot,
(SELECT COUNT(*) FROM cur_rep C WHERE C.chamber_id = A.id) AS crep_tot,
(SELECT COUNT(*) FROM old_dem D WHERE D.chamber_id = A.id) AS odem_tot,
(SELECT COUNT(*) FROM cur_rep E WHERE E.chamber_id = A.id) AS orep_tot,
(SELECT COUNT(*) FROM ret_off F WHERE F.chamber_id = A.id) AS retu_tot,
(SELECT COUNT(*) FROM web_for G WHERE G.chamber_id = A.id) AS wfor_tot,
(SELECT COUNT(*) FROM ema_ily H WHERE H.chamber_id = A.id) AS emai_tot,
(SELECT COUNT(*) FROM has_fbs I WHERE I.chamber_id = A.id AND I.tot > 0 ) AS yfcb_tot,
(SELECT COUNT(*) FROM has_twi J WHERE J.chamber_id = A.id AND J.tot > 0 ) AS ytwi_tot


FROM chambers_with_election_in_range A

