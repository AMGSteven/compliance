import requests
import json
import random

def post_sample_lead_to_bpo():
    # API endpoint
    url = "https://compliance.juicedmedia.io/api/leads"
    
    # API key for authentication
    headers = {
        "token": "70942646-125b-4ddd-96fc-b9a142c698b8",
        "Content-Type": "application/json"
    }
    
    # Allowed states
    allowed_states = ["AL", "AR", "AZ", "IN", "KS", "LA", "MO", "MS", "OH", "SC", "TN", "TX"]
    
    # Generate sample data
    sample_lead = {
        # Required fields
        "first_name": "John",
        "last_name": "Doe",
        "email": f"johndoe{random.randint(1000, 9999)}@example.com",  # Random email to avoid duplicates
        "phone": f"92555{random.randint(10000, 99999)}",  # Random phone to avoid duplicates
        "state": random.choice(allowed_states),
        "list_id": "pitch-bpo-list-1749233817305",
        
        # Recommended fields
        "campaign_id": "pitch-bpo-campaign-1749233817305",
        "cadence_id": "pitch-bpo-cadence-1749233817305",
        "city": "Austin",
        "zip": "78701",
        "income_bracket": "100000-150000",
        "homeowner_status": "Yes",
        "age_range": "35-44",
        "traffic_source": "test_script",
        "ip_address": "192.168.1.1",
        "landing_page": "https://test-page.com",
        "tc_agreed": True
    }
    
    # Make the API request
    print(f"Sending sample lead to BPO API: {json.dumps(sample_lead, indent=2)}")
    
    try:
        response = requests.post(url, headers=headers, json=sample_lead)
        
        # Print the response status and content
        print(f"\nResponse Status: {response.status_code}")
        print(f"Response Body: {json.dumps(response.json(), indent=2)}")
        
        # Check if it was sent to the dialer
        if response.status_code == 200 and response.json().get("success"):
            dialer_info = response.json().get("dialer", {})
            if dialer_info.get("forwarded"):
                print("\n✅ Lead was successfully sent to the dialer!")
                print(f"Dialer Type: {dialer_info.get('type')}")
                print(f"Dialer Status: {dialer_info.get('status')}")
            else:
                print("\n❌ Lead was not forwarded to the dialer.")
        else:
            print("\n❌ Failed to submit lead.")
            
    except Exception as e:
        print(f"\nError: {str(e)}")

if __name__ == "__main__":
    post_sample_lead_to_bpo()
