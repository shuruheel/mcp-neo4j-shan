import os
import requests
import json
import sys

def get_access_token(user, pwd):
    response = requests.post(
        'https://api.neo4j.io/oauth/token',
        auth=(user, pwd),
        headers={'Content-Type': 'application/x-www-form-urlencoded'},
        data={'grant_type': 'client_credentials'}
    )
    response.raise_for_status()
    return response.json()['access_token']

def get_instances(access_token, tenant_id):
    response = requests.get(
        f"https://api.neo4j.io/v1/instances?tenantId={tenant_id}",
        headers={"Authorization": f"Bearer {access_token}", 'Content-Type': 'application/json'}
    )
    response.raise_for_status()
    return response.json()['data']

def pause_instance(access_token, dbid):
    response = requests.post(
        f"https://api.neo4j.io/v1/instances/{dbid}/pause",
        headers={"Authorization": f"Bearer {access_token}", 'Content-Type': 'application/json'}
    )
    if response.status_code == 200:
        print(f"Paused instance {dbid}")
    else:
        response.raise_for_status()

def resume_instance(access_token, dbid):
    response = requests.post(
        f"https://api.neo4j.io/v1/instances/{dbid}/resume",
        headers={"Authorization": f"Bearer {access_token}", 'Content-Type': 'application/json'}
    )
    if response.status_code == 200:
        print(f"Resumed instance {dbid}")
    else:
        response.raise_for_status()

def main(action):
    user = os.getenv('CLIENT_ID')
    pwd = os.getenv('CLIENT_PWD')
    tenant_id = os.getenv('TENANT_ID')
    if action not in ['start', 'stop']:
        print("Invalid action. Use 'start' or 'stop'.")
        sys.exit(1)
    access_token = get_access_token(user, pwd)
    instances = get_instances(access_token, tenant_id)
    instance_names_to_manage = ['github-action-cron']  # Add your instance name here
    for instance in instances:
        if instance['name'] in instance_names_to_manage:
            dbid = instance['id']
            if action == 'stop':
                pause_instance(access_token, dbid)
            elif action == 'start':
                resume_instance(access_token, dbid)

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python manage_instances.py [start|stop]")
        sys.exit(1)
    action = sys.argv[1].lower()
    main(action)