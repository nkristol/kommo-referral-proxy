module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const KOMMO_SUBDOMAIN = 'hiramvargasia';
  const ACCESS_TOKEN = process.env.KOMMO_ACCESS_TOKEN;
  const REFERRAL_FIELD_ID = 1413702;
  const COMPLETED_STAGE_ID = 93151468;

  const { code, month, year } = req.query;

  if (!code || month === undefined || !year) {
    return res.status(400).json({ error: 'Missing parameters' });
  }

  try {
    const startDate = Math.floor(new Date(year, month, 1).getTime() / 1000);
    const endDate = Math.floor(new Date(year, parseInt(month) + 1, 0, 23, 59, 59).getTime() / 1000);
    
    let allLeads = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await fetch(
        `https://${KOMMO_SUBDOMAIN}.kommo.com/api/v4/leads?page=${page}&limit=250`,
        {
          headers: {
            'Authorization': `Bearer ${ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) throw new Error('Kommo API error');

      const data = await response.json();
      
      if (data._embedded?.leads) {
        allLeads = allLeads.concat(data._embedded.leads);
        hasMore = data._embedded.leads.length === 250;
        page++;
      } else {
        hasMore = false;
      }
    }
    
    let initialContacts = 0;
    let completedConsults = 0;

    allLeads.forEach(lead => {
      if (!lead.custom_fields_values) return;
      
      const referralField = lead.custom_fields_values.find(f => 
        f.field_id === REFERRAL_FIELD_ID
      );
      
      if (!referralField?.values?.[0]) return;
      
      const leadCode = referralField.values[0].value;
      
      if (leadCode.toUpperCase() !== code.toUpperCase()) return;
      if (lead.created_at < startDate || lead.created_at > endDate) return;
      
      initialContacts++;
      
      if (lead.status_id === COMPLETED_STAGE_ID) {
        completedConsults++;
      }
    });

    return res.json({
      initialContacts,
      completedConsults,
      commission: completedConsults * 100
    });
    
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};
