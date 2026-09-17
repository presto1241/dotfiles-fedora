# .bashrc

# Source global definitions
if [ -f /etc/bashrc ]; then
    . /etc/bashrc
fi

# User specific environment
if ! [[ "$PATH" =~ "$HOME/.local/bin:$HOME/bin:" ]]; then
    PATH="$HOME/.local/bin:$HOME/bin:$PATH"
fi
export PATH

# Uncomment the following line if you don't like systemctl's auto-paging feature:
# export SYSTEMD_PAGER=

# User specific aliases and functions
if [ -d ~/.bashrc.d ]; then
    for rc in ~/.bashrc.d/*; do
        if [ -f "$rc" ]; then
            . "$rc"
        fi
    done
fi
unset rc
export LIBVIRT_DEFAULT_URI="qemu:///system"

# Anything here is meant to show up when the konsole gets created
[[ $- == *i* ]] && cat /home/presto/Desktop/.bash-startup.txt

# Added by LM Studio CLI (lms)
export PATH="$PATH:/home/presto/.lmstudio/bin"
# End of LM Studio CLI section

export PATH="$PATH:/home/presto/.dotnet/tools"
export PATH="$PATH:/home/presto/.cargo/bin"
export PS1="\n┌ \u \w\\n└> "



#THIS MUST BE AT THE END OF THE FILE FOR SDKMAN TO WORK!!!
export SDKMAN_DIR="$HOME/.sdkman"
[[ -s "$HOME/.sdkman/bin/sdkman-init.sh" ]] && source "$HOME/.sdkman/bin/sdkman-init.sh"
