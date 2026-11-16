using UnityEngine;

namespace ValleyCamcorder
{
    internal sealed class ValleyFragmentSound : MonoBehaviour
    {
        ValleyAudio sound;
        string bank;
        float created;
        public void Bind(ValleyAudio voice,string cue)
        {
            sound=voice;
            bank=cue;
            created=Time.time;
        }

        void OnCollisionEnter(Collision collision)
        {
            if(collision.relativeVelocity.magnitude<1.9f || collision.contactCount==0 || Time.time-created<.12f) return;
            sound.WorldCue(bank,collision.GetContact(0).point,Mathf.Clamp(collision.relativeVelocity.magnitude*.086f,.17f,.62f));
            Destroy(this);
        }
    }
}
